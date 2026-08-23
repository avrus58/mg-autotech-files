import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasStaffPermission } from "@/lib/staffPermissions";
import { listAdminEmailDeliveryIssues } from "@/lib/email/deliveryReliability";
import {
  buildAdminRequestAccess,
  projectAdminOrderRow,
} from "@/lib/workOrders/access";
import { getAdminOrderRows } from "@/lib/workOrders/server";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

const customerSelect =
  "id, email, customer_id, full_name, role, credit_balance, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact, allow_negative_credits, negative_credit_limit, account_status, customer_tags, internal_admin_note, created_at";
const fallbackCustomerSelect =
  "id, email, customer_id, full_name, role, credit_balance, account_type, company_name, phone, street, postal_code, city, country, vat_id, invoice_email, preferred_contact, allow_negative_credits, negative_credit_limit, account_status, internal_admin_note, created_at";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders }
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const requestAccess = buildAdminRequestAccess(auth.access);
    const orderQuery = getAdminOrderRows();
    const customerQuery = hasStaffPermission(auth.access, "customers.view")
      ? admin.from("profiles")
        .select(customerSelect)
        .eq("role", "customer")
        .order("created_at", { ascending: false })
      : Promise.resolve(null);
    const [orderResult, customerResult, emailIssues] = await Promise.all([
      orderQuery,
      customerQuery,
      requestAccess.messagesManage
        ? listAdminEmailDeliveryIssues()
        : Promise.resolve([]),
    ]);

    if (orderResult.error) {
      return NextResponse.json(
        { error: "Admin dashboard orders could not be loaded." },
        { status: 500, headers: privateNoStoreHeaders }
      );
    }

    let customers: Record<string, unknown>[] = [];

    if (hasStaffPermission(auth.access, "customers.view")) {
      if (customerResult?.error?.code === "42703") {
        const fallbackResult = await admin
          .from("profiles")
          .select(fallbackCustomerSelect)
          .eq("role", "customer")
          .order("created_at", { ascending: false });

        if (fallbackResult.error) {
          return NextResponse.json(
            { error: "Admin dashboard customers could not be loaded." },
            { status: 500, headers: privateNoStoreHeaders }
          );
        }

        customers = (fallbackResult.data ?? []).map((customer) => ({
          ...customer,
          credit_balance: requestAccess.creditsManage ? customer.credit_balance : null,
          allow_negative_credits: requestAccess.creditsManage
            ? customer.allow_negative_credits
            : null,
          negative_credit_limit: requestAccess.creditsManage
            ? customer.negative_credit_limit
            : null,
          customer_tags: [],
        }));
      } else if (customerResult?.error) {
        return NextResponse.json(
          { error: "Admin dashboard customers could not be loaded." },
          { status: 500, headers: privateNoStoreHeaders }
        );
      } else {
        customers = (customerResult?.data ?? []).map((customer) => ({
          ...customer,
          credit_balance: requestAccess.creditsManage ? customer.credit_balance : null,
          allow_negative_credits: requestAccess.creditsManage
            ? customer.allow_negative_credits
            : null,
          negative_credit_limit: requestAccess.creditsManage
            ? customer.negative_credit_limit
            : null,
        }));
      }
    }

    return NextResponse.json(
      {
        access: {
          role: auth.access.role,
          staffRole: auth.access.staffRole,
          permissions: auth.access.permissions,
        },
        orders: orderResult.rows.map((order) =>
          projectAdminOrderRow(order as unknown as Record<string, unknown>, requestAccess)
        ),
        customers,
        emailIssues,
      },
      { headers: privateNoStoreHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Admin dashboard could not be loaded." },
      { status: 500, headers: privateNoStoreHeaders }
    );
  }
}
