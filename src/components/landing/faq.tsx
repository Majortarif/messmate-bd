"use client";

import { useTranslations } from "next-intl";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ITEMS = ["money", "privacy", "free", "install", "manager"] as const;

export function Faq() {
  const t = useTranslations("landing.faq");
  return (
    <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
      {ITEMS.map((key) => (
        <AccordionItem key={key} value={key}>
          <AccordionTrigger className="py-5 text-left text-base">{t(`items.${key}.q`)}</AccordionTrigger>
          <AccordionContent className="pb-5 text-[0.95rem] leading-relaxed text-muted-foreground">
            {t(`items.${key}.a`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
