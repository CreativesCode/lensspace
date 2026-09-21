"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { FormSelect } from "@/shared/components";
import { PrescriptionFormFields } from "@/features/prescriptions/components";
import {
  friendlyPrescriptionError,
  prescriptionAttachmentError,
  prescriptionFileExtension,
  prescriptionRevisionValues,
  validatePrescriptionForm,
} from "@/features/prescriptions/prescription-validation";
import { friendlyPaymentError } from "@/features/orders/payment-errors";
import { CustomerFormFields, customerFormValues, type CustomerPhoneDraft } from "@/features/customers/components";

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
type Item = {
  id: number;
  organizationId: number | null;
  name: string;
  category: string;
  price: number;
  currency: string;
};
type PriceResult = {
  lineItems: { name: string; baseAmount: number; amount: number; currency: string; adjustmentReason?: string | null }[];
  totals: Record<string, number>;
  cupEquivalent: number | null;
  warnings: { message: string }[];
};
type PrescriptionResult = {
  prescriptionId: number;
  revisionId: number;
  revisionNumber: number;
};
type AcceptedOrder = { orderId: number; orderNumber: string };
type Payment = { id: number; amount: number; currency: string; appliedRate: number; equivalentCup: number; receivedAt: string };
type OrderSummary = { orderId: number; orderNumber: string; totalCup: number; paidCup: number; balanceCup: number; paymentStatus: string; saleRate: number | null; payments: Payment[] };

const categoryLabels: Record<string, string> = {
  vision_type: "Tipo de visión",
  lens_material: "Material del cristal",
  treatment: "Tratamiento",
  frame: "Armadura",
  mounting: "Montaje",
  adjustment: "Ajuste",
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
  items: Item[];
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
    availableItems.reduce<Record<string, Item[]>>((groups, item) => {
      (groups[item.category] ??= []).push(item);
      return groups;
    }, {}),
  );
  const selectedCustomer = customerRows.find(
    (entry) => entry.id === customerId,
  );
  const inputClass =
    "w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]";

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog]);

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
    return (
      <p className="rounded-lg border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">
        No tienes una sucursal comercial disponible.
      </p>
    );
  if (acceptedOrder && preview && selectedCustomer)
    return (
      <AcceptedOrderWorkspace
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
  return (
    <>
      <form
        onSubmit={save}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]"
      >
        <div className="space-y-5">
          <section className="rounded-[10px] border border-[#E3EFED] bg-white p-4 shadow-[0_8px_24px_rgba(7,50,47,0.04)] sm:p-5">
            <div className="mb-4 flex gap-2">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${step <= 3 ? "bg-[#35C2A8]" : "bg-[#E3EFED]"}`}
                />
              ))}
            </div>
            <h2 className="font-display text-lg font-semibold text-[#07322F]">
              Cliente y receta
            </h2>
            <div className="mt-4 space-y-3">
              <FormSelect
                ariaLabel="Organización y sucursal"
                value={scopeKey}
                onValueChange={changeScope}
                options={organizations.map((entry) => ({
                  value: `${entry.id}:${entry.branchId}`,
                  label: `${entry.name} · ${entry.branchName}`,
                }))}
              />
              <QuickPicker
                label="Cliente"
                actionLabel="Nuevo cliente"
                onAction={() => {
                  setDialogMessage("");
                  setDialog("customer");
                }}
              >
                <FormSelect
                  ariaLabel="Cliente"
                  value={String(customerId)}
                  onValueChange={(value) => {
                    setCustomerId(Number(value));
                    setRevisionId(0);
                    resetQuote();
                  }}
                  options={[
                    { value: "0", label: "Selecciona cliente" },
                    ...availableCustomers.map((entry) => ({
                      value: String(entry.id),
                      label: entry.name,
                    })),
                  ]}
                />
              </QuickPicker>
              <QuickPicker
                label="Receta"
                actionLabel="Nueva receta"
                disabled={!customerId}
                onAction={() => {
                  setDialogMessage("");
                  setDialog("prescription");
                }}
              >
                <FormSelect
                  ariaLabel="Receta asociada"
                  value={String(revisionId)}
                  onValueChange={(value) => {
                    setRevisionId(Number(value));
                    resetQuote();
                  }}
                  options={[
                    { value: "0", label: "Sin receta asociada" },
                    ...availableRevisions.map((entry) => ({
                      value: String(entry.id),
                      label: entry.label,
                    })),
                  ]}
                />
              </QuickPicker>
              <div className="flex flex-col gap-3 rounded-lg border border-[#DCECEA] bg-[#F7FBFA] p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#07322F]">
                    Tasa de esta venta
                  </p>
                  <p className="text-xs leading-5 text-[#74857F]">
                    Se usa para convertir importes en USD y queda congelada al
                    crear el pedido.
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#4A5B58]">
                  <span>1 USD =</span>
                  <input
                    aria-label="Tasa de cambio de USD a CUP"
                    className={`${inputClass} w-28 text-right font-semibold`}
                    value={rate}
                    onChange={(event) => {
                      setRate(event.target.value);
                      resetQuote();
                    }}
                    type="number"
                    min="0.01"
                    step="0.01"
                    onBlur={() => {
                      const numericRate = Number(rate);
                      if (Number.isFinite(numericRate))
                        setRate(String(Math.round(numericRate * 100) / 100));
                    }}
                    required
                  />
                  <span>CUP</span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-[10px] border border-[#E3EFED] bg-white p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-[#07322F]">
              Configuración
            </h2>
            <p className="mt-1 text-sm text-[#74857F]">
              Toca cada opción que formará parte de la cotización.
            </p>
            <div className="mt-5 space-y-5">
              {groupedItems.map(([category, categoryItems]) => (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#74857F]">
                    {categoryLabels[category] ?? "Otro concepto"}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryItems.map((item) => {
                      const active = selected.includes(item.id);
                      const agreedAmount = agreedPrices[item.id] ?? String(item.price);
                      const isAdjusted = Number(agreedAmount) !== item.price;
                      return (
                        <div key={item.id} className={`rounded-lg border p-3 transition ${active ? "border-[#0D7A72] bg-[#F0FBF9] ring-1 ring-[#0D7A72]" : "border-[#E3EFED] bg-white"}`}>
                          <button type="button" aria-pressed={active} onClick={() => toggle(item.id)} className="w-full text-left">
                            <strong className="block font-display text-sm text-[#07322F]">{item.name}</strong>
                            <span className="mt-1 block text-sm font-semibold text-[#0D7A72]">Base: {item.price.toLocaleString("es-CU")} {item.currency}</span>
                          </button>
                          {active ? (
                            <div className="mt-3 space-y-2 border-t border-[#DCECEA] pt-3">
                              <label className="block text-xs font-semibold text-[#4A5B58]">Precio acordado ({item.currency})
                                <input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={agreedAmount} onChange={(event) => updateAgreedPrice(item.id, event.target.value)} />
                              </label>
                              {isAdjusted ? (
                                <label className="block text-xs font-semibold text-[#4A5B58]">Motivo del ajuste
                                  <input className={`${inputClass} mt-1`} minLength={5} maxLength={300} placeholder="Ej.: promoción o trabajo especial" value={adjustmentReasons[item.id] ?? ""} onChange={(event) => updateAdjustmentReason(item.id, event.target.value)} />
                                </label>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <textarea
              className={`${inputClass} mt-5 min-h-20`}
              name="notes"
              maxLength={1000}
              placeholder="Notas comerciales opcionales"
            />
          </section>
        </div>

        <aside className="h-fit rounded-[10px] border border-[#E3EFED] bg-white xl:sticky xl:top-6">
          <div className="border-b border-[#EEF5F4] p-5">
            <h2 className="font-display text-lg font-semibold text-[#07322F]">
              Cotización
            </h2>
            <p className="mt-1 text-xs text-[#74857F]">
              {selected.length} conceptos seleccionados
            </p>
          </div>
          <div className="space-y-4 p-5">
            {preview ? (
              <>
                {preview.lineItems.map((line, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#4A5B58]">{line.name}</span>
                      <strong className="whitespace-nowrap text-[#07322F]">
                        {Number(line.amount).toLocaleString("es-CU")} {line.currency}
                      </strong>
                    </div>
                    {Number(line.baseAmount) !== Number(line.amount) ? (
                      <p className="mt-1 text-xs text-[#74857F]">
                        Base {Number(line.baseAmount).toLocaleString("es-CU")} {line.currency} · {line.adjustmentReason}
                      </p>
                    ) : null}
                  </div>
                ))}
                <div className="border-t border-dashed border-[#DCECEA] pt-3">
                  {Object.entries(preview.totals).map(([currency, total]) => (
                    <p
                      key={currency}
                      className="flex justify-between font-display text-xl font-bold text-[#07322F]"
                    >
                      <span>Total</span>
                      <span>
                        {Number(total).toLocaleString("es-CU")} {currency}
                      </span>
                    </p>
                  ))}
                  {preview.cupEquivalent !== null ? (
                    <p className="mt-2 text-right text-xs text-[#74857F]">
                      Equivalente:{" "}
                      {Number(preview.cupEquivalent).toLocaleString("es-CU")}{" "}
                      CUP
                    </p>
                  ) : null}
                </div>
                {preview.warnings.map((warning, index) => (
                  <p
                    key={index}
                    className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-xs text-[#7A3A26]"
                  >
                    {warning.message}
                  </p>
                ))}
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-[#DCECEA] p-5 text-sm text-[#74857F]">
                Guarda para obtener el desglose definitivo.
              </p>
            )}
            <button
              disabled={pending || !organization?.canOperate}
              className="w-full rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {quotationId ? "Actualizar cotización" : "Guardar cotización"}
            </button>
            {quotationId ? (
              <button
                type="button"
                onClick={accept}
                disabled={pending}
                className="w-full rounded-[8px] bg-[#07322F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Cliente acepta · crear pedido
              </button>
            ) : null}
            {message ? (
              <p role="status" className="text-sm text-[#4A5B58]">
                {message}
              </p>
            ) : null}
          </div>
        </aside>
      </form>

      {dialog === "customer" ? (
        <Dialog
          title="Nuevo cliente"
          subtitle={`${organization?.name} · ${organization?.branchName}`}
          onClose={() => setDialog(null)}
          wide
        >
          <form onSubmit={createCustomer} className="space-y-4">
            <CustomerFormFields fullName={newCustomerName} onFullNameChange={setNewCustomerName} phones={newCustomerPhones} onPhonesChange={setNewCustomerPhones} fieldClass={`${inputClass} mt-1`} />
            {dialogMessage ? (
              <p
                role="alert"
                className="rounded-lg bg-[#FFF6F2] p-3 text-sm text-[#7A3A26]"
              >
                {dialogMessage}
              </p>
            ) : null}
            <DialogActions
              pending={savingQuick}
              onCancel={() => setDialog(null)}
              label="Crear y seleccionar"
            />
          </form>
        </Dialog>
      ) : null}

      {dialog === "prescription" ? (
        <Dialog
          title="Nueva receta"
          subtitle={selectedCustomer?.name ?? "Cliente"}
          onClose={() => setDialog(null)}
          wide
        >
          <form onSubmit={createPrescription} className="space-y-4" noValidate>
            <PrescriptionFormFields fieldClass={`${inputClass} mt-1`} />
            {dialogMessage ? (
              <p
                role="alert"
                className="rounded-lg bg-[#FFF6F2] p-3 text-sm text-[#7A3A26]"
              >
                {dialogMessage}
              </p>
            ) : null}
            <DialogActions
              pending={savingQuick}
              onCancel={() => setDialog(null)}
              label="Guardar y asociar"
            />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

function AcceptedOrderWorkspace({ order, customerName, preview, onNewSale }: { order: AcceptedOrder; customerName: string; preview: PriceResult; onNewSale: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const inputClass = "w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]";
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [currency, setCurrency] = useState("CUP");
  const [message, setMessage] = useState("Pedido creado. Puedes registrar ahora el primer cobro.");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const { data, error } = await supabase.rpc("get_order_payment_summary", { target_order_id: order.orderId } as never);
    if (error) throw error;
    const next = data as unknown as OrderSummary;
    setSummary(next);
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("get_order_payment_summary", { target_order_id: order.orderId } as never).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMessage("El pedido fue creado, pero no pudimos cargar su saldo. Puedes abrirlo desde Pedidos y cobros.");
      else setSummary(data as unknown as OrderSummary);
    });
    return () => { cancelled = true; };
  }, [order.orderId, supabase]);

  function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = Number(form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return setMessage("Indica un importe mayor que cero.");
    startTransition(async () => {
      setMessage("");
      const { error } = await supabase.rpc("register_cash_payment", {
        target_order_id: order.orderId,
        payment_amount: amount,
        payment_currency: currency,
        payment_applied_rate: currency === "USD" ? Number(form.get("rate")) : 1,
        payment_notes: String(form.get("notes") ?? ""),
      } as never);
      if (error) return setMessage(friendlyPaymentError(error));
      try {
        await refresh();
        formElement.reset();
        setMessage("Cobro registrado correctamente.");
      } catch {
        setMessage("El cobro se registró, pero no pudimos actualizar el saldo en pantalla.");
      }
    });
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-[10px] border border-[#B9DFD9] bg-[#F0FBF9] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D7A72]">Pedido creado</p><h2 className="mt-1 font-display text-2xl font-bold text-[#07322F]">{order.orderNumber}</h2><p className="mt-1 text-sm text-[#4A5B58]">Cliente: {customerName}</p></div>
          <button type="button" onClick={onNewSale} className="rounded-[8px] border border-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-[#0D7A72]">Comenzar otra venta</button>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
        <h3 className="font-display text-lg font-semibold text-[#07322F]">Detalle del pedido</h3>
        <div className="mt-3 divide-y divide-[#EEF5F4]">{preview.lineItems.map((line, index) => <div key={`${line.name}:${index}`} className="flex justify-between gap-4 py-3 text-sm"><span className="text-[#4A5B58]">{line.name}</span><strong className="shrink-0 text-[#07322F]">{Number(line.amount).toLocaleString("es-CU", { maximumFractionDigits: 2 })} {line.currency}</strong></div>)}</div>
        <div className="mt-3 border-t border-dashed border-[#B9DFD9] pt-3">{Object.entries(preview.totals).map(([totalCurrency, total]) => <p key={totalCurrency} className="flex justify-between font-display text-xl font-bold text-[#07322F]"><span>Total</span><span>{Number(total).toLocaleString("es-CU", { maximumFractionDigits: 2 })} {totalCurrency}</span></p>)}</div>
      </div>

      <div className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#74857F]">Saldo pendiente</p><p className="mt-1 font-display text-2xl font-bold text-[#07322F]">{summary ? `${Number(summary.balanceCup).toLocaleString("es-CU", { maximumFractionDigits: 2 })} CUP` : "Cargando…"}</p>{summary ? <p className="mt-1 text-xs text-[#74857F]">Cobrado: {Number(summary.paidCup).toLocaleString("es-CU", { maximumFractionDigits: 2 })} CUP equivalentes</p> : null}</div>
        {summary && summary.balanceCup > 0 ? <form onSubmit={registerPayment} className="mt-4 grid gap-3 rounded-lg bg-[#F7FBFA] p-4 sm:grid-cols-2"><h3 className="font-display font-semibold text-[#07322F] sm:col-span-2">Registrar cobro en efectivo</h3><label className="text-xs font-semibold text-[#4A5B58]">Importe<input autoFocus className={`${inputClass} mt-1`} name="amount" type="number" min="0.01" step="0.01" required /></label><label className="text-xs font-semibold text-[#4A5B58]">Moneda<FormSelect className="mt-1" ariaLabel="Moneda del cobro" value={currency} onValueChange={setCurrency} options={[{ value: "CUP", label: "CUP" }, { value: "USD", label: "USD" }]} /></label>{currency === "USD" ? <label className="text-xs font-semibold text-[#4A5B58]">Tasa aplicada<input className={`${inputClass} mt-1`} name="rate" type="number" min="0.01" step="0.01" defaultValue={summary.saleRate ?? 420} required /></label> : null}<label className="text-xs font-semibold text-[#4A5B58]">Nota opcional<input className={`${inputClass} mt-1`} name="notes" maxLength={500} /></label><button disabled={pending} className="rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{pending ? "Registrando…" : "Registrar cobro"}</button></form> : summary ? <p className="mt-4 rounded-lg bg-[#E2F4F1] p-4 text-sm font-semibold text-[#07655C]">Pedido pagado completamente.</p> : null}
        {message ? <p role="alert" className="mt-4 rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-sm text-[#7A3A26]">{message}</p> : null}
      </div>
    </section>
  );
}

function QuickPicker({
  label,
  actionLabel,
  onAction,
  disabled = false,
  children,
}: {
  label: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#4A5B58]">{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAction}
          className="text-xs font-semibold text-[#0D7A72] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#9AABA7]"
        >
          + {actionLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function Dialog({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-[12px] bg-white shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E3EFED] bg-white p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#0D7A72]">
              {subtitle}
            </p>
            <h2
              id="sales-dialog-title"
              className="mt-1 font-display text-xl font-bold text-[#07322F]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-xl text-[#07322F]"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function DialogActions({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[#EEF5F4] pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]"
      >
        Cancelar
      </button>
      <button
        formNoValidate
        disabled={pending}
        className="rounded-[7px] bg-[#07322F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : label}
      </button>
    </div>
  );
}
