import PageShell from "@/components/PageShell";

const KNOWN: ReadonlySet<string> = new Set(
  [
    "Gasabo", "Kicukiro", "Nyarugenge",
    "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
    "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
    "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango",
    "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
  ].map((d) => d.toLowerCase()),
);

function titleDistrict(slug: string): string {
  const lower = slug.toLowerCase();
  if (!KNOWN.has(lower)) {
    // Capitalise first letter only for unknown slugs (still readable).
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function BriefPage({
  params,
}: {
  params: { district: string };
}) {
  const district = titleDistrict(params.district);
  return (
    <PageShell titleKey="pages.brief_heading" titleValues={{ district }} />
  );
}
