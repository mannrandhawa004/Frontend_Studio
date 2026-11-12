import type { Metadata } from "next";
import AdminStudio from "../../components/admin-studio";

export const metadata: Metadata = {
  title: "Admin",
  description: "Manage templates, uploads, builds, and publishing.",
};

export default function AdminPage() {
  return <AdminStudio />;
}
