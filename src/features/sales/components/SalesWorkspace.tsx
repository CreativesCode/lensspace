"use client";

import { CircleCheck, Plus, Save, Store, UserPlus } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { friendlyError, isNetworkError } from "@/shared/lib/friendly-error";
import { CustomerFormFields, customerFormValues, type CustomerPhoneDraft } from "@/features/customers/components";
import { PrescriptionFormFields } from "@/features/prescriptions/components";
import {
  friendlyPrescriptionError,
  prescriptionAttachmentError,
  prescriptionFileExtension,
  prescriptionRevisionValues,
  validatePrescriptionForm,
} from "@/features/prescriptions/prescription-validation";
import { createClient } from "@/lib/supabase/client";
import { FormSelect } from "@/shared/components";
import { Alert, Button, Card, Dialog, EmptyState, Field, Input, Steps, Textarea } from "@/shared/ui";

import { AcceptedOrderPanel } from "./AcceptedOrderPanel";
import { CustomerSearchPicker, type SaleCustomer } from "./CustomerSearchPicker";
import { ItemPicker } from "./ItemPicker";
import { QuoteSummary } from "./QuoteSummary";
import type { AcceptedOrder, PriceResult, SaleItem } from "./sale-types";

type Organization = {
  id: number;
  name: string;
  branchId: number;
  branchName: string;
  canOperate: boolean;
  canApproveLargeDiscount: boolean;
};
type Revision = {
  id: number;
  organizationId: number;
  branchId: number;
  customerId: number;
  label: string;
};
type PrescriptionResult = {
  prescriptionId: number;
  revisionId: number;
  revisionNumber: number;
};

export function SalesWorkspace({
  organizations,
  recentCustomers,
  items,
}: {
  organizations: Organization[];
  recentCustomers: SaleCustomer[];
  items: SaleItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [scopeKey, setScopeKey] = useState(
    organizations[0]
      ? `${organizations[0].id}:${organizations[0].branchId}`
      : "",
  );
  const [selectedCustomer, setSelectedCustomer] = useState<SaleCustomer | null>(null);
  const [revisionRows, setRevisionRows] = useState<Revision[]>([]);
  const [revisionId, setRevisionId] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [agreedPrices, setAgreedPrices] = useState<Record<number, string>>({});
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<number, string>>({});
  const [rate, setRate] = useState("420");
  const [quotationId, setQuotationId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PriceResult | null>(null);
  const [acceptedOrder, setAcceptedOrder] = useState<AcceptedOrder | null>(null);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"customer" | "prescription" | null>(
    null,
  );
  const [dialogMessage, setDialogMessage] = useState("");
  const [savingQuick, setSavingQuick] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhones, setNewCustomerPhones] = useState<CustomerPhoneDraft[]>([{ number: "", label: "Principal", whatsappEnabled: true }]);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const organization = organizations.find(
    (entry) => `${entry.id}:${entry.branchId}` === scopeKey,
  );
  const organizationId = organization?.id ?? 0;
  const customerId = selectedCustomer?.id ?? 0;
  const availableRecentCustomers = recentCustomers.filter(
    (entry) =>
      entry.organizationId === organizationId &&
      entry.branchId === organization?.branchId,
  );
  const availableRevisions = revisionRows.filter(
    (entry) => entry.customerId === customerId,
  );
  const availableItems = items.filter(
    (item) =>
      item.organizationId === null || item.organizationId === organizationId,
  );
  const groupedItems = Object.entries(
    availableItems.reduce<Record<string, SaleItem[]>>((groups, item) => {
      (groups[item.category] ??= []).push(item);
      return groups;
    }, {}),
  );
  const selectedItems = availableItems.filter((item) => selected.includes(item.id));
  // Client-side running total (agreed prices); the server confirms it on save and may
  // add graduation surcharges, so the UI labels it as an estimate.
  const estimate = selectedItems.reduce<Record<string, number>>((totals, item) => {
    const agreed = Number(agreedPrices[item.id]?.trim() || item.price);
    totals[item.currency] = (totals[item.currency] ?? 0) + (Number.isFinite(agreed) ? agreed : item.price);
    return totals;
  }, {});
  const numericRateValue = Number(rate) || 0;
  const estimateCup = Object.entries(estimate).reduce(
    (sum, [currency, total]) => sum + (currency === "USD" ? total * numericRateValue : total),
    0,
  );

  function selectCustomer(customer: SaleCustomer) {
    setSelectedCustomer(customer);
    setRevisionId(0);
    resetQuote();
    void supabase
      .from("prescription_revisions")
      .select("id, organization_id, branch_id, prescription_id, prescription_date, prescriptions!inner(customer_id)")
      .eq("prescriptions.customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as { id: number; organization_id: number; branch_id: number; prescription_id: number; prescription_date: string }[];
        setRevisionRows((current) => [
          ...current.filter((entry) => entry.customerId !== customer.id),
          ...rows.map((row) => ({ id: row.id, organizationId: row.organization_id, branchId: row.branch_id, customerId: customer.id, label: `Receta #${row.prescription_id} · ${row.prescription_date}` })),
        ]);
      });
  }

  function resetQuote() {
    setQuotationId(null);
    setPreview(null);
  }
  function updateAgreedPrice(itemId: number, value: string) {
    setAgreedPrices((current) => ({ ...current, [itemId]: value }));
    resetQuote();
  }
  function updateAdjustmentReason(itemId: number, value: string) {
    setAdjustmentReasons((current) => ({ ...current, [itemId]: value }));
    resetQuote();
  }
  function toggle(itemId: number) {
    setSelected((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
    resetQuote();
  }
  function changeScope(value: string) {
    setScopeKey(value);
    setSelectedCustomer(null);
    setRevisionId(0);
    setSelected([]);
    setAgreedPrices({});
    setAdjustmentReasons({});
    setMessage("");
    resetQuote();
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization?.canOperate)
      return setDialogMessage(
        "Esta organización está en modo de solo lectura.",
      );
    const form = new FormData(event.currentTarget);
    const values = customerFormValues(form, newCustomerName, newCustomerPhones);
    const name = values.fullName;
    if (name.length < 2 || values.phones.length !== newCustomerPhones.length)
      return setDialogMessage(
        "Completa el nombre y un teléfono de al menos cinco dígitos.",
      );
    setSavingQuick(true);
    setDialogMessage("");
    const { data, error } = await supabase.rpc("create_customer_with_phones", {
      target_organization_id: organization.id,
      target_branch_id: organization.branchId,
      customer_full_name: name,
      customer_national_id: values.nationalId,
      customer_address: values.address,
      customer_birth_date: values.birthDate,
      customer_notes: values.notes,
      customer_messaging_consent: values.messagingConsent,
      phone_entries: values.phones,
    } as never);
    if (error) {
      setDialogMessage(friendlyError(error, "No se pudo registrar el cliente."));
      setSavingQuick(false);
      return;
    }
    setSelectedCustomer({
      id: Number(data),
      organizationId: organization.id,
      branchId: organization.branchId,
      name,
    });
    setRevisionId(0);
    setNewCustomerName("");
    setNewCustomerPhones([{ number: "", label: "Principal", whatsappEnabled: true }]);
    setDialog(null);
    setMessage(`${name} quedó seleccionado para esta venta.`);
    setSavingQuick(false);
  }

  async function createPrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization?.canOperate || !selectedCustomer)
      return setDialogMessage("Selecciona primero el cliente de la receta.");
    const form = new FormData(event.currentTarget);
    const validationError = validatePrescriptionForm(form);
    if (validationError) return setDialogMessage(validationError);
    const attachment = form.get("attachment");
    const attachmentError = prescriptionAttachmentError(attachment);
    if (attachmentError) return setDialogMessage(attachmentError);
    setSavingQuick(true);
    setDialogMessage("");
    const { data, error } = await supabase.rpc("create_prescription_revision", {
      target_organization_id: organization.id,
      target_branch_id: organization.branchId,
      target_customer_id: selectedCustomer.id,
      target_prescription_id: null,
      ...prescriptionRevisionValues(form),
      revision_change_reason: "",
    } as never);
    if (error) {
      setDialogMessage(friendlyPrescriptionError(error.message));
      setSavingQuick(false);
      return;
    }
    const result = data as unknown as PrescriptionResult;
    let attachmentFailed = false;
    if (attachment instanceof File && attachment.size) {
      const path = `${organization.id}/${organization.branchId}/${result.prescriptionId}/${result.revisionId}/${crypto.randomUUID()}.${prescriptionFileExtension(attachment)}`;
      const { error: uploadError } = await supabase.storage
        .from("prescription-originals")
        .upload(path, attachment, {
          contentType: attachment.type,
          upsert: false,
        });
      if (uploadError) {
        attachmentFailed = true;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error: metadataError } = await supabase
          .from("prescription_files")
          .insert({
            organization_id: organization.id,
            branch_id: organization.branchId,
            prescription_id: result.prescriptionId,
            revision_id: result.revisionId,
            storage_path: path,
            file_name: attachment.name,
            mime_type: attachment.type,
            byte_size: attachment.size,
            uploaded_by: userData.user!.id,
          } as never);
        if (metadataError) {
          attachmentFailed = true;
          await supabase.storage.from("prescription-originals").remove([path]);
        }
      }
    }
    const date = String(form.get("prescriptionDate"));
    const created: Revision = {
      id: result.revisionId,
      organizationId: organization.id,
      branchId: organization.branchId,
      customerId: selectedCustomer.id,
      label: `Receta #${result.prescriptionId} · ${date}`,
    };
    setRevisionRows((current) => [created, ...current]);
    setRevisionId(created.id);
    setDialog(null);
    setMessage(
      attachmentFailed
        ? "La receta quedó asociada, pero el original no pudo almacenarse. Puedes adjuntarlo desde Recetas."
        : "La receta nueva quedó asociada a esta venta.",
    );
    resetQuote();
    setSavingQuick(false);
  }

  // Validates agreed prices; returns the adjustments or a Spanish error message.
  function lineAdjustmentsOrError(): Record<string, { amount: number; reason: string }> | string {
    if (!organization || !customerId || !selected.length)
      return "Selecciona cliente y al menos un concepto.";
    const lineAdjustments: Record<string, { amount: number; reason: string }> = {};
    for (const item of selectedItems) {
      const rawAmount = agreedPrices[item.id]?.trim();
      if (!rawAmount) continue;
      const amount = Number(rawAmount);
      if (!Number.isFinite(amount) || amount < 0)
        return `Indica un precio válido para ${item.name}.`;
      if (amount === item.price) continue;
      const reason = adjustmentReasons[item.id]?.trim() ?? "";
      if (reason.length < 5)
        return `Explica el ajuste de ${item.name} en al menos 5 caracteres.`;
      if (amount < item.price * 0.9 && !organization.canApproveLargeDiscount)
        return `El descuento de ${item.name} supera el 10 %. Debe autorizarlo un propietario.`;
      lineAdjustments[String(item.id)] = { amount, reason };
    }
    return lineAdjustments;
  }

  // Prices and saves in parallel (save_quotation reprices on its own); returns the
  // quotation id, or null after reporting the error.
  async function persistQuote(lineAdjustments: Record<string, { amount: number; reason: string }>) {
    if (!organization) return null;
    const notes = String(new FormData(formRef.current ?? undefined).get("notes") ?? "");
    const numericRate = rate ? Number(rate) : null;
    const [{ data: price, error: priceError }, { data, error }] = await Promise.all([
      supabase.rpc("calculate_sale_price", {
        target_organization_id: organizationId,
        selected_item_ids: selected,
        target_prescription_revision_id: revisionId || null,
        usd_to_cup_rate: numericRate,
        line_adjustments: lineAdjustments,
      } as never),
      supabase.rpc("save_quotation", {
        target_quotation_id: quotationId,
        target_organization_id: organizationId,
        target_branch_id: organization.branchId,
        target_customer_id: customerId,
        target_prescription_revision_id: revisionId || null,
        selected_item_ids: selected,
        target_usd_to_cup_rate: numericRate,
        target_notes: notes,
        target_line_adjustments: lineAdjustments,
      } as never),
    ]);
    if (error) {
      setMessage(friendlyError(error, "No pudimos guardar la cotización."));
      return null;
    }
    if (priceError) setMessage(friendlyError(priceError, "La cotización se guardó, pero no pudimos mostrar el desglose."));
    else setPreview(price as unknown as PriceResult);
    setQuotationId(Number(data));
    return Number(data);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const adjustments = lineAdjustmentsOrError();
    if (typeof adjustments === "string") return setMessage(adjustments);
    startTransition(async () => {
      setMessage("");
      if (await persistQuote(adjustments))
        setMessage("Cotización guardada. Confirma los importes con el cliente.");
    });
  }

  // "Cliente acepta" works in one tap: it saves the quotation first when needed.
  function accept() {
    const adjustments = quotationId ? {} : lineAdjustmentsOrError();
    if (typeof adjustments === "string") return setMessage(adjustments);
    startTransition(async () => {
      setMessage("");
      const targetQuotationId = quotationId ?? (await persistQuote(adjustments));
      if (!targetQuotationId) return;
      // accept_quotation is idempotent, so a dropped response is retried once.
      const acceptOnce = () =>
        supabase.rpc("accept_quotation", {
          target_quotation_id: targetQuotationId,
        } as never);
      let { data, error } = await acceptOnce();
      if (error && isNetworkError(error)) ({ data, error } = await acceptOnce());
      if (error)
        return setMessage(
          isNetworkError(error)
            ? "Sin conexión: no pudimos confirmar el pedido. Pulsa “Cliente acepta” otra vez cuando vuelva la señal; no se creará un pedido duplicado."
            : friendlyError(error, "No pudimos confirmar el pedido."),
        );
      const result = data as unknown as AcceptedOrder;
      setMessage(
        `Pedido ${result.orderNumber} creado con precios y tasa inmutables.`,
      );
      setAcceptedOrder(result);
      setQuotationId(null);
    });
  }

  if (!organizations.length)
    return <EmptyState icon={Store} title="Sin sucursal comercial" description="No tienes una sucursal comercial disponible." />;
  if (acceptedOrder && selectedCustomer)
    return (
      <AcceptedOrderPanel
        order={acceptedOrder}
        customerName={selectedCustomer.name}
        preview={preview}
        onNewSale={() => {
          setAcceptedOrder(null);
          setSelectedCustomer(null);
          setRevisionId(0);
          setSelected([]);
          setAgreedPrices({});
          setAdjustmentReasons({});
          setPreview(null);
          setMessage("");
        }}
      />
    );

  const currentStep = !customerId ? 0 : !selected.length ? 1 : !quotationId ? 2 : 3;
  return (
    <>
      <form ref={formRef} onSubmit={save} className="grid items-start gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_390px] xl:pb-0">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <Steps label="Progreso de la venta" steps={["Cliente", "Configuración", "Cotización", "Pedido"]} current={currentStep} />
            <h2 className="font-display text-[17px] font-semibold text-ink">Cliente y receta</h2>
            {organizations.length > 1 ? (
              <Field label="Organización y sucursal">
                <FormSelect
                  ariaLabel="Organización y sucursal"
                  value={scopeKey}
                  onValueChange={changeScope}
                  options={organizations.map((entry) => ({ value: `${entry.id}:${entry.branchId}`, label: `${entry.name} · ${entry.branchName}` }))}
                />
              </Field>
            ) : null}
            <QuickPicker label="Cliente" actionLabel="Nuevo cliente" onAction={() => { setDialogMessage(""); setDialog("customer"); }}>
              <CustomerSearchPicker
                organizationId={organizationId}
                branchId={organization?.branchId ?? 0}
                recent={availableRecentCustomers}
                selected={selectedCustomer}
                onSelect={selectCustomer}
                onClear={() => { setSelectedCustomer(null); setRevisionId(0); resetQuote(); }}
              />
            </QuickPicker>
            <QuickPicker label="Receta" actionLabel="Nueva receta" disabled={!customerId} onAction={() => { setDialogMessage(""); setDialog("prescription"); }}>
              <FormSelect
                ariaLabel="Receta asociada"
                value={String(revisionId)}
                onValueChange={(value) => { setRevisionId(Number(value)); resetQuote(); }}
                options={[{ value: "0", label: "Sin receta asociada" }, ...availableRevisions.map((entry) => ({ value: String(entry.id), label: entry.label }))]}
              />
            </QuickPicker>
            <div className="flex flex-col gap-3 rounded-control border border-line bg-canvas p-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Tasa de esta venta</p>
                <p className="text-[13px] leading-5 text-text-muted">Se usa para convertir importes en USD y queda congelada al crear el pedido.</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-secondary">
                <span>1 USD =</span>
                <span className="w-28">
                  <Input
                    aria-label="Tasa de cambio de USD a CUP"
                    value={rate}
                    onChange={(event) => { setRate(event.target.value); resetQuote(); }}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    numeric
                    onBlur={() => {
                      const numericRate = Number(rate);
                      if (Number.isFinite(numericRate)) setRate(String(Math.round(numericRate * 100) / 100));
                    }}
                    required
                  />
                </span>
                <span>CUP</span>
              </label>
            </div>
          </Card>

          <Card className="flex flex-col gap-5">
            <div>
              <h2 className="font-display text-[17px] font-semibold text-ink">Configuración</h2>
              <p className="mt-1 text-sm text-text-muted">Toca cada opción que formará parte de la cotización.</p>
            </div>
            <ItemPicker
              groupedItems={groupedItems}
              selected={selected}
              agreedPrices={agreedPrices}
              adjustmentReasons={adjustmentReasons}
              onToggle={toggle}
              onAgreedPriceChange={updateAgreedPrice}
              onAdjustmentReasonChange={updateAdjustmentReason}
            />
            <Field label="Notas comerciales" optional>
              <Textarea name="notes" maxLength={1000} />
            </Field>
          </Card>
        </div>

        <QuoteSummary preview={preview} estimate={estimate} estimateCup={estimateCup} selectedCount={selected.length} quotationId={quotationId} pending={pending} canOperate={Boolean(organization?.canOperate)} canAccept={Boolean(customerId && selected.length)} message={message} onAccept={accept} />
      </form>

      {/* Below xl the summary sits after the catalog: keep total and the main action in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line-soft bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-6px_18px_rgba(7,50,47,0.08)] xl:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-text-muted">{preview ? "Total" : "Total estimado"} · {selected.length === 1 ? "1 concepto" : `${selected.length} conceptos`}</p>
          <p className="truncate font-display text-lg font-bold tabular-nums text-ink">{summaryTotalLabel(preview, estimate)}</p>
        </div>
        <Button variant="ink" icon={CircleCheck} onClick={accept} disabled={pending || !organization?.canOperate || !customerId || !selected.length} className="shrink-0">{pending ? "Procesando…" : "Cliente acepta"}</Button>
      </div>

      <Dialog
        open={dialog === "customer"}
        onClose={() => setDialog(null)}
        eyebrow={`${organization?.name} · ${organization?.branchName}`}
        title="Nuevo cliente"
        size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
          <Button type="submit" form="sales-new-customer" formNoValidate icon={UserPlus} disabled={savingQuick}>{savingQuick ? "Guardando…" : "Crear y seleccionar"}</Button>
        </>}
      >
        <form id="sales-new-customer" onSubmit={createCustomer} className="flex flex-col gap-4">
          <CustomerFormFields fullName={newCustomerName} onFullNameChange={setNewCustomerName} phones={newCustomerPhones} onPhonesChange={setNewCustomerPhones} />
          {dialogMessage ? <Alert tone="danger" role="alert">{dialogMessage}</Alert> : null}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "prescription"}
        onClose={() => setDialog(null)}
        eyebrow={selectedCustomer?.name ?? "Cliente"}
        title="Nueva receta"
        size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
          <Button type="submit" form="sales-new-prescription" formNoValidate icon={Save} disabled={savingQuick}>{savingQuick ? "Guardando…" : "Guardar y asociar"}</Button>
        </>}
      >
        <form id="sales-new-prescription" onSubmit={createPrescription} className="flex flex-col gap-4" noValidate>
          <PrescriptionFormFields />
          {dialogMessage ? <Alert tone="danger" role="alert">{dialogMessage}</Alert> : null}
        </form>
      </Dialog>
    </>
  );
}

function QuickPicker({ label, actionLabel, onAction, disabled = false, children }: { label: string; actionLabel: string; onAction: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-text-label">{label}</span>
        <Button variant="ghost" size="sm" icon={Plus} disabled={disabled} onClick={onAction} className="-mr-2">{actionLabel}</Button>
      </div>
      {children}
    </div>
  );
}

const totalFormat = new Intl.NumberFormat("es-CU", { maximumFractionDigits: 2 });

function summaryTotalLabel(preview: PriceResult | null, estimate: Record<string, number>) {
  const totals = Object.entries(preview?.totals ?? estimate);
  return totals.length ? totals.map(([currency, total]) => `${totalFormat.format(total)} ${currency}`).join(" + ") : "—";
}
