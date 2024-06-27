export const config = {
  domainSource: "https://4366f312-f4d0-4eff-a251-563612c31dfe.weweb-preview.io", // Your WeWeb app link
  metaDataEndpoint: "https://x7ya-rkul-ymbs.f2.xano.io/api:tQNSyF-Q/weweb/events/metadata/{eventID}", // Link of the endpoint that returns the metadata. /{id} will be added to this path. With id being the last parameter of the dynamic page
  patterns: {
    dynamicPage: "/event/[^/]+"
  }
};
