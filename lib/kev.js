// 실제 악용 중인 취약점 — CISA Known Exploited Vulnerabilities 목록에서 최근에 추가된 것
// 원본은 1.8MB쯤이라 서버에서 최신 몇 건만 추려 보낸다.
const URL_KEV = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export async function fetchKev(limit = 20) {
  const res = await fetch(URL_KEV, { headers: { 'User-Agent': 'urigg.pages.dev (personal dashboard)', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`kev ${res.status}`);
  const data = await res.json();
  const items = [...data.vulnerabilities]
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.cveID.localeCompare(a.cveID))
    .slice(0, limit)
    .map((v) => ({
      cve: v.cveID,
      vendor: v.vendorProject,
      product: v.product,
      name: v.vulnerabilityName,
      desc: v.shortDescription,
      added: v.dateAdded, // 미국 날짜 (YYYY-MM-DD)
      ransomware: v.knownRansomwareCampaignUse === 'Known',
    }));
  return { fetchedAt: new Date().toISOString(), version: data.catalogVersion, count: data.count, items };
}
