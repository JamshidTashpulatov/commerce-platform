import { PageHeader } from "@/components/admin/kit";
import { PeerPortfolioSetting } from "@/components/admin/peer-portfolio-setting";

export default function Settings() {
  return (
    <>
      <PageHeader title="Sozlamalar" description="Parolni chap pastdagi hisob menyusidan o‘zgartirasiz." />
      <PeerPortfolioSetting />
    </>
  );
}
