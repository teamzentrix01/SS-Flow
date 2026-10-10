import { redirect } from "next/navigation";
import { homeFor } from "@/lib/access";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session) : "/login");
}
