export const config = {
    domainSource: "https://www.martialmap.com", // Your WeWeb app link
    patterns: [
        {
            pattern: "/event/[^/]+",
            metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:tQNSyF-Q/weweb/events/metadata/{eventID}"
        },
        {
            pattern: "/club/[^/]+",
            metaDataEndpoint: "https://another-api.example.com/meta/{id}"
        }
        // Add more patterns and their metadata endpoints as needed
    ]
};  
