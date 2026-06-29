"use client";

import { PublicVehicleSelector } from "@/components/widget/PublicVehicleSelector";
import type { WidgetClient, WidgetLanguage } from "@/lib/widget/types";

export function VehicleLookupPreview({ client, language }: { client: Pick<WidgetClient, "widget_title" | "button_text" | "main_color" | "button_text_color" | "difference_color" | "theme_mode" | "show_branding">; language: WidgetLanguage }) {
  return <PublicVehicleSelector demo config={{ ...client, language }} />;
}

