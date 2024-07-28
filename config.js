export const config = {
  domainSource: "https://test.martialmap.com", // Your WeWeb app preview link
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
            pattern: "/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:APGncCGF/weweb/clubs/metadata/slug/{slug}"
        }
        // Add more patterns and their metadata endpoints as needed
    ]
};  
