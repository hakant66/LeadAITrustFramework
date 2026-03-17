import { redirect } from "next/navigation";
import ProjectRegisterPage from "@/app/(components)/ProjectRegisterPage";
import { resolveNavMode } from "@/lib/navMode";

export default function AdminRootPage() {
  const navMode = resolveNavMode();
  if (navMode !== "legacy") {
    redirect("/projects/register");
  }
  return <ProjectRegisterPage navMode={navMode} />;
}
