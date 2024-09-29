export const config = {
  domainSource: "https://4366f312-f4d0-4eff-a251-563612c31dfe.weweb-preview.io", // Your WeWeb app preview link
  patterns: [
      
        {
            pattern: "/event/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:tQNSyF-Q/weweb/events/metadata/{eventID}"
        },
        {
            pattern: "/club/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:APGncCGF/weweb/clubs/metadata/{clubID}"
        },
	{
            pattern: "/federation/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:nOwe_not/weweb/federation/metadata/{id}"
        },
	{
            pattern: "/categories/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:vyycyb66/weweb/beltAndRanking/metadata/{slug}"
        },
	{
            pattern: "/news/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:nOwe_not/weweb/news/metadata/{slug}/"
        },
	{
            pattern: "/job/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:ZeYJ0jKz/weweb/jobs/metadata/{jobID}"
        }
        // Add more patterns and their metadata endpoints as needed
    ]
};  
