import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // Extracting configuration values
      const domainSource = config.domainSource;
      const patterns = config.patterns;

      console.log("Worker started");
      console.log("Incoming request headers:", Object.fromEntries(request.headers));

      // Parse the request URL
      const url = new URL(request.url);
      const referer = request.headers.get('Referer');

      // Function to get the pattern configuration that matches the URL
      function getPatternConfig(url) {
        for (const patternConfig of patterns) {
          const regex = new RegExp(patternConfig.pattern);
          let pathname = url + (url.endsWith('/') ? '' : '/');
          if (regex.test(pathname)) {
            return patternConfig;
          }
        }
        return null;
      }

      // Function to check if the URL matches the page data pattern
      function isPageData(url) {
        const pattern = /\/public\/data\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json/;
        return pattern.test(url);
      }

      async function requestMetadata(url, metaDataEndpoint) {
        const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const parts = trimmedUrl.split('/');
        const id = parts[parts.length - 1];
        const placeholderPattern = /{([^}]+)}/;
        const metaDataEndpointWithId = metaDataEndpoint.replace(placeholderPattern, id);
        const metaDataResponse = await fetch(metaDataEndpointWithId);
        const metadata = await metaDataResponse.json();
        return metadata;
      }

      // Handle dynamic page requests
      const patternConfig = getPatternConfig(url.pathname);
      if (patternConfig) {
        console.log("Dynamic page detected:", url.pathname);
        let source = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source response headers:", Object.fromEntries(source.headers));
        const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
        console.log("Metadata fetched:", metadata);
        const customHeaderHandler = new CustomHeaderHandler(metadata);
        const transformedResponse = new HTMLRewriter()
          .on('*', customHeaderHandler)
          .transform(source);

        const headers = new Headers(transformedResponse.headers);
        headers.set('x-robots-tag', 'index, follow');

        console.log("Final response headers:", Object.fromEntries(headers));

        return new Response(transformedResponse.body, {
          status: transformedResponse.status,
          statusText: transformedResponse.statusText,
          headers: headers
        });
      } else if (isPageData(url.pathname)) {
        console.log("Page data detected:", url.pathname);
        console.log("Referer:", referer);
        const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source data response headers:", Object.fromEntries(sourceResponse.headers));
        let sourceData = await sourceResponse.json();
        
        let pathname = referer;
        pathname = pathname ? pathname + (pathname.endsWith('/') ? '' : '/') : null;
        if (pathname !== null) {
          const patternConfigForPageData = getPatternConfig(pathname);
          if (patternConfigForPageData) {
            const metadata = await requestMetadata(pathname, patternConfigForPageData.metaDataEndpoint);
            console.log("Metadata fetched:", metadata);

            // Update sourceData with metadata
            sourceData.page = sourceData.page || {};
            sourceData.page.title = sourceData.page.title || {};
            sourceData.page.meta = sourceData.page.meta || {};
            sourceData.page.meta.desc = sourceData.page.meta.desc || {};
            sourceData.page.meta.keywords = sourceData.page.meta.keywords || {};
            sourceData.page.socialTitle = sourceData.page.socialTitle || {};
            sourceData.page.socialDesc = sourceData.page.socialDesc || {};

            if (metadata.title) {
              sourceData.page.title.en = metadata.title;
              sourceData.page.socialTitle.en = metadata.title;
            }
            if (metadata.description) {
              sourceData.page.meta.desc.en = metadata.description;
              sourceData.page.socialDesc.en = metadata.description;
            }
            if (metadata.image) {
              sourceData.page.metaImage = metadata.image;
            }
            if (metadata.keywords) {
              sourceData.page.meta.keywords.en = metadata.keywords;
            }
          }
        }
        
        console.log("returning file: ", JSON.stringify(sourceData));
        const response = new Response(JSON.stringify(sourceData), {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log("Final page data response headers:", Object.fromEntries(response.headers));
        return response;
      }

      console.log("Fetching original content for:", url.pathname);
      const sourceUrl = new URL(`${domainSource}${url.pathname}`);
      const sourceRequest = new Request(sourceUrl, request);
      const sourceResponse = await fetch(sourceRequest);
      console.log("Final response headers:", Object.fromEntries(sourceResponse.headers));
      return sourceResponse;
    } catch (error) {
      console.error("Worker threw an exception:", error.message);
      console.error("Error stack:", error.stack);
      return new Response(`Worker Error: ${error.message}`, { status: 500 });
    }
  }
};

class CustomHeaderHandler {
  constructor(metadata) {
    this.metadata = metadata;
  }

  element(element) {
    if (element.tagName === "title") {
      console.log('Replacing title tag content');
      element.setInnerContent(this.metadata.title);
    }
    if (element.tagName === "meta") {
      const name = element.getAttribute("name");
      if (name === "robots") {
        element.setAttribute("content", "index, follow");
      } else {
        switch (name) {
          case "title":
          case "description":
          case "image":
          case "keywords":
          case "twitter:title":
          case "twitter:description":
            element.setAttribute("content", this.metadata[name.replace('twitter:', '')] || '');
            break;
        }
      }
      const itemprop = element.getAttribute("itemprop");
      if (["name", "description", "image"].includes(itemprop)) {
        element.setAttribute("content", this.metadata[itemprop] || '');
      }
      const type = element.getAttribute("property");
      if (["og:title", "og:description", "og:image"].includes(type)) {
        console.log(`Replacing ${type}`);
        element.setAttribute("content", this.metadata[type.replace('og:', '')] || '');
      }
    }
  }
}
