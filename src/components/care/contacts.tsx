"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError, FormField, LoadingButton } from "@/components/shared/form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteContact, saveContact } from "@/lib/actions/care";
import type { ErrorKey } from "@/lib/errors";
import { type ContactInput, contactSchema } from "@/lib/validations/care";

export type Messmate = { id: string; name: string; phone: string | null };

const EMPTY: ContactInput = {
  name: "",
  relation: "",
  phone: "",
  contactUserId: null,
  isPrimary: false,
  notifyOnSos: true,
  notifyOnSick: true,
  notifyOnCheckin: true,
};

function ContactForm({ contactId, initial, messmates, onDone }: { contactId?: string; initial: ContactInput; messmates: Messmate[]; onDone: () => void }) {
  const t = useTranslations("care.contacts.form");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const form = useForm<ContactInput, unknown, z.output<typeof contactSchema>>({ resolver: zodResolver(contactSchema), defaultValues: initial });
  const { errors } = form.formState;

  const toggle = (name: "isPrimary" | "notifyOnSos" | "notifyOnSick" | "notifyOnCheckin", label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
          <span className="text-sm">{label}</span>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  );

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(() =>
        startTransition(async () => {
          setError(null);
          const result = await saveContact(form.getValues(), contactId);
          if (!result.ok) return setError(result.error);
          toast.success(t("saved"));
          onDone();
        }),
      )}
    >
      {messmates.length > 0 && (
        <FormField label={t("messmate")} hint={t("messmateHint")} optional>
          {(field) => (
            <Controller
              control={form.control}
              name="contactUserId"
              render={({ field: f }) => (
                <Select
                  value={f.value ?? "none"}
                  onValueChange={(v) => {
                    const mate = messmates.find((m) => m.id === v);
                    f.onChange(mate ? mate.id : null);
                    if (mate) {
                      form.setValue("name", mate.name);
                      if (mate.phone) form.setValue("phone", mate.phone);
                    }
                  }}
                >
                  <SelectTrigger id={field.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("notMessmate")}</SelectItem>
                    {messmates.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("name")} error={errors.name}>
          {(field) => <Input {...field} maxLength={80} {...form.register("name")} />}
        </FormField>
        <FormField label={t("relation")} error={errors.relation} optional>
          {(field) => <Input {...field} maxLength={40} placeholder={t("relationPlaceholder")} {...form.register("relation")} />}
        </FormField>
      </div>
      <FormField label={t("phone")} error={errors.phone}>
        {(field) => <Input {...field} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...form.register("phone")} />}
      </FormField>
      <div className="grid gap-2">
        {toggle("isPrimary", t("primary"))}
        {toggle("notifyOnSos", t("onSos"))}
        {toggle("notifyOnSick", t("onSick"))}
        {toggle("notifyOnCheckin", t("onCheckin"))}
      </div>
      <FormError error={error} />
      <LoadingButton type="submit" loading={pending}>
        {t("save")}
      </LoadingButton>
    </form>
  );
}

export function AddContactButton({ messmates }: { messmates: Messmate[] }) {
  const t = useTranslations("care.contacts");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("addTitle")} description={t("addBody")}>
        <ContactForm initial={EMPTY} messmates={messmates} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}

export function ContactMenu({ id, name, initial, messmates }: { id: string; name: string; initial: ContactInput; messmates: Messmate[] }) {
  const t = useTranslations("care.contacts");
  const te = useTranslations("errors");
  const [edit, setEdit] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { name })}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              startTransition(async () => {
                const result = await deleteContact(id);
                if (!result.ok) toast.error(te(result.error));
              })
            }
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog open={edit} onOpenChange={setEdit} title={t("editTitle")}>
        <ContactForm contactId={id} initial={initial} messmates={messmates} onDone={() => setEdit(false)} />
      </ResponsiveDialog>
    </>
  );
}
