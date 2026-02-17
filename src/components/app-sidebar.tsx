"use client";

import {
    LayoutDashboard,
    Building2,
    CalendarDays,
    BookOpen,
    DollarSign,
    Send,
    FileDown,
    BarChart3,
    Settings,
    ChevronDown,
    Globe,
    Receipt,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import LanguageSwitcher from "@/components/LanguageSwitcher";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
    const t = useTranslations();
    const locale = useLocale();
    const pathname = usePathname();
    const dir = locale === "ar" ? "rtl" : "ltr";
    const side = locale === "ar" ? "right" : "left";

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const coreItems = [
        { href: "/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
        { href: "/units", label: t("nav_units"), icon: Building2 },
        { href: "/calendar", label: t("nav_calendar"), icon: CalendarDays },
    ];

    const operationsItems = [
        { href: "/bookings", label: t("nav_bookings"), icon: BookOpen },
        { href: "/rates", label: t("nav_rates"), icon: DollarSign },
        { href: "/publishing", label: t("nav_publishing"), icon: Send },
    ];

    const adminItems = [
        { href: "/imports/booking/ops", label: t("nav_import"), icon: FileDown },
        { href: "/content", label: t("nav_content"), icon: Globe },
        { href: "/reports", label: t("nav_reports"), icon: BarChart3 },
        { href: "/expenses", label: t("nav_expenses"), icon: Receipt },
        { href: "/payouts", label: t("nav_payouts"), icon: DollarSign },
        { href: "/settings", label: t("nav_settings"), icon: Settings },
    ];

    return (
        <Sidebar side={side} dir={dir} collapsible="icon">
            {/* Header - Logo */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg" tooltip="PMS Lite">
                            <Link href="/">
                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex size-8 items-center justify-center rounded-lg font-bold text-sm shrink-0">
                                    P
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">PMS Lite</span>
                                    <span className="text-xs text-sidebar-foreground/60">
                                        Property Manager
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarSeparator />

            <SidebarContent>
                {/* Core */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t("sidebar_core")}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {coreItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* Operations */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t("sidebar_operations")}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {operationsItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* Admin & Tools */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t("sidebar_admin")}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {adminItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter>
                <SidebarSeparator />
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex items-center justify-center p-2 group-data-[collapsible=icon]:p-0">
                            <LanguageSwitcher />
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
