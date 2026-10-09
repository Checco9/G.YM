import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";

export default async function Index() {
  redirect((await getSessionUser()) ? "/home" : "/login");
}
