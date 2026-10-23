"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useTranslations("statementPage");
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      {t("print")}
    </Button>
  );
}
