"use client";

import { Plus, Save, Store, UserPlus } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";

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
type Customer = {
  id: number;
  organizationId: number;
  branchId: number;
  name: string;
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
  customers,
  revisions,
  items,
}: {
  organizations: Organization[];
  customers: Customer[];
  revisions: Revision[];
  items: SaleItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [scopeKey, setScopeKey] = useState(
    organizations[0]
      ? `${organizations[0].id}:${organizations[0].branchId}`
      : "",
  );
  const [customerRows, setCustomerRows] = useState(customers);
  const [revisionRows, setRevisionRows] = useState(revisions);
  const [customerId, setCustomerId] = useState(0);
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

  const organization = organizations.find(
    (entry) => `${entry.id}:${entry.branchId}` === scopeKey,
  );
  const organizationId = organization?.id ?? 0;
  const availableCustomers = customerRows.filter(
    (entry) =>
      entry.organizationId === organizationId &&
      entry.branchId === organization?.branchId,
  );
  const availableRevisions = revisionRows.filter(
    (entry) =>
      entry.organizationId === organizationId &&
      entry.branchId === organization?.branchId &&
      entry.customerId === customerId,
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
  const selectedCustomer = customerRows.find(
    (entry) => entry.id === customerId,
  );

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
    setCustomerId(0);
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
    const existing = availableCustomers.find(
      (customer) =>
        customer.name.trim().toLocaleLowerCase("es") ===
        name.toLocaleLowerCase("es"),
    );
    if (existing) {
      setCustomerId(existing.id);
      setDialogMessage(
        "Ya existe un cliente con ese nombre en esta sucursal. Lo seleccionamos para que revises su ficha.",
      );
      return;
    }
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
      setDialogMessage(error.message || "No se pudo registrar el cliente.");
      setSavingQuick(false);
      return;
    }
    const created: Customer = {
      id: Number(data),
      organizationId: organization.id,
      branchId: organization.branchId,
      name,
    };
    setCustomerRows((current) => [...current, created]);
    setCustomerId(created.id);
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

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !customerId || !selected.length)
      return setMessage("Selecciona cliente y al menos un concepto.");
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "");
    const lineAdjustments: Record<string, { amount: number; reason: string }> = {};
    for (const item of availableItems.filter((entry) => selected.includes(entry.id))) {
      const rawAmount = agreedPrices[item.id]?.trim();
      if (!rawAmount) continue;
      const amount = Number(rawAmount);
      if (!Number.isFinite(amount) || amount < 0)
        return setMessage(`Indica un precio válido para ${item.name}.`);
      if (amount === item.price) continue;
      const reason = adjustmentReasons[item.id]?.trim() ?? "";
      if (reason.length < 5)
        return setMessage(`Explica el ajuste de ${item.name} en al menos 5 caracteres.`);
      if (amount < item.price * 0.9 && !organization.canApproveLargeDiscount)
        return setMessage(`El descuento de ${item.name} supera el 10 %. Debe autorizarlo un propietario.`);
      lineAdjustments[String(item.id)] = { amount, reason };
    }
    startTransition(async () => {
      setMessage("");
      const numericRate = rate ? Number(rate) : null;
      const { data: price, error: priceError } = await supabase.rpc(
        "calculate_sale_price",
        {
          target_organization_id: organizationId,
          selected_item_ids: selected,
          target_prescription_revision_id: revisionId || null,
          usd_to_cup_rate: numericRate,
          line_adjustments: lineAdjustments,
        } as never,
      );
      if (priceError) return setMessage(priceError.message);
      const { data, error } = await supabase.rpc("save_quotation", {
        target_quotation_id: quotationId,
        target_organization_id: organizationId,
        target_branch_id: organization.branchId,
        target_customer_id: customerId,
        target_prescription_revision_id: revisionId || null,
        selected_item_ids: selected,
        target_usd_to_cup_rate: numericRate,
        target_notes: notes,
        target_line_adjustments: lineAdjustments,
      } as never);
      if (error) return setMessage(error.message);
      setPreview(price as unknown as PriceResult);
      setQuotationId(Number(data));
      setMessage("Cotización guardada. Confirma los importes con el cliente.");
    });
  }

  function accept() {
    if (!quotationId) return;
    startTransition(async () => {
      const { data, error } = await supabase.rpc("accept_quotation", {
        target_quotation_id: quotationId,
      } as never);
      if (error) return setMessage(error.message);
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
  if (acceptedOrder && preview && selectedCustomer)
    return (
      <AcceptedOrderPanel
        order={acceptedOrder}
        customerName={selectedCustomer.name}
        preview={preview}
        onNewSale={() => {
          setAcceptedOrder(null);
          setCustomerId(0);
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
      <form onSubmit={save} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <Steps label="Progreso de la venta" steps={["Cliente", "Configuración", "Cotización", "Pedido"]} current={currentStep} />
            <h2 className="font-display text-[17px] font-semibold text-ink">Cliente y receta</h2>
            <Field label="Organización y sucursal">
              <FormSelect
                ariaLabel="Organización y sucursal"
                value={scopeKey}
                onValueChange={changeScope}
                options={organizations.map((entry) => ({ value: `${entry.id}:${entry.branchId}`, label: `${entry.name} · ${entry.branchName}` }))}
              />
            </Field>
            <QuickPicker label="Cliente" actionLabel="Nuevo cliente" onAction={() => { setDialogMessage(""); setDialog("customer"); }}>
              <FormSelect
                ariaLabel="Cliente"
                value={String(customerId)}
                onValueChange={(value) => { setCustomerId(Number(value)); setRevisionId(0); resetQuote(); }}
                options={[{ value: "0", label: "Selecciona cliente" }, ...availableCustomers.map((entry) => ({ value: String(entry.id), label: entry.name }))]}
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

        <QuoteSummary preview={preview} selectedCount={selected.length} quotationId={quotationId} pending={pending} canOperate={Boolean(organization?.canOperate)} message={message} onAccept={accept} />
      </form>

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
