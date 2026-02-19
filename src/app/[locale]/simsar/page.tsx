'use client';

import { SimsarChat } from "@/components/simsar/chat";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function SimsarPage() {
  const t = useTranslations('simsar');

  return (
    <div className="container mx-auto py-6 px-4 max-w-screen">
      <h1 className="text-2xl font-bold mb-4">{t('simsar')}</h1>
      
      <Button onClick={() => window.history.back()} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('back')}
      </Button>

      <SimsarChat />
    </div>
  );
}
