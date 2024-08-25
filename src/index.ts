import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Worker started");
      console.log("Incoming request URL:", request.url);
      console.log("Incoming request headers:", Object.fromEntries(request.headers));

      const url = new URL(request.url);
      const domainSource = config.domainSource;
      const patterns = config.patterns;

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

      function isPageData(url) {
        const pattern = /\/public\/data\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json/;
        return pattern.test(url);
      }

      async function requestMetadata(url, metaDataEndpoint) {
        try {
          const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
          const parts = trimmedUrl.split('/');
          const id = parts[parts.length - 1];
          const placeholderPattern = /{([^}]+)}/;
          const metaDataEndpointWithId = metaDataEndpoint.replace(placeholderPattern, id);
          
          console.log(`Fetching metadata from: ${metaDataEndpointWithId}`);
          const metaDataResponse = await fetch(metaDataEndpointWithId);
          const metadata = await metaDataResponse.json();
          
          if (metadata.code === "ERROR_FATAL") {
            console.error("Metadata fetch error:", metadata.message);
            return null;
          }
          
          console.log("Metadata fetched successfully:", metadata);
          return metadata;
        } catch (error) {
          console.error("Error in requestMetadata:", error);
          return null;
        }
      }

      const patternConfig = getPatternConfig(url.pathname);
      if (patternConfig) {
        console.log("Dynamic page detected:", url.pathname);
        let source = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source response headers:", Object.fromEntries(source.headers));

        const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
        if (!metadata) {
          console.log("No valid metadata found, serving original content");
          return source;
        }

        console.log("Applying metadata to HTML:");
        console.log("Title:", metadata.title);
        console.log("Description:", metadata.description);
        console.log("Image:", metadata.image);
        console.log("Keywords:", metadata.keywords);

        const customHeaderHandler = new CustomHeaderHandler(metadata);
        const transformedResponse = new HTMLRewriter()
          .on('title', customHeaderHandler)
          .on('meta', customHeaderHandler)
          .on('link[rel="canonical"]', customHeaderHandler)
          .transform(source);

        const headers = new Headers(transformedResponse.headers);
        
        headers.set('X-Worker-Executed', 'true');
        headers.set('Cache-Control', 'no-store, must-revalidate');
        headers.set('x-robots-tag', 'index, follow');

        console.log("Final response headers:", Object.fromEntries(headers));

        return new Response(transformedResponse.body, {
          status: transformedResponse.status,
          statusText: transformedResponse.statusText,
          headers: headers
        });
      }

      // Handle other requests (non-dynamic pages and page data)
      console.log("Non-dynamic content detected, serving original content");
      return fetch(request);

    } catch (error) {
      console.error("Worker threw an exception:", error.message);
      console.error("Error stack:", error.stack);
      return new Response(`Worker Error: ${error.message}`, { 
        status: 500,
        headers: {
          'X-Worker-Executed': 'true',
          'x-robots-tag': 'noindex',
          'Cache-Control': 'no-store, must-revalidate'
        }
      });
    }
  }
};

class CustomHeaderHandler {
  constructor(metadata) {
    this.metadata = metadata;
    this.titleUpdated = false;
  }

  element(element) {
    if (element.tagName === "title") {
      console.log('Found title tag, current content:', element.textContent);
      element.setInnerContent(this.metadata.title);
      console.log('Set new title content:', this.metadata.title);
      this.titleUpdated = true;
    } else if (element.tagName === "meta") {
      const name = element.getAttribute("name");
      const property = element.getAttribute("property");
      console.log(`Found meta tag: name=${name}, property=${property}`);
      
      if (name === "description" || property === "og:description") {
        element.setAttribute("content", this.metadata.description);
      } else if (name === "keywords") {
        element.setAttribute("content", this.metadata.keywords);
      } else if (name === "title" || property === "og:title") {
        element.setAttribute("content", this.metadata.title);
      } else if (name === "image" || property === "og:image") {
        element.setAttribute("content", this.metadata.image);
      } else if (name === "robots") {
        element.setAttribute("content", "index, follow");
      }
      
      console.log(`Updated meta tag content:`, element.getAttribute("content"));
    } else if (element.tagName === "link" && element.getAttribute("rel") === "canonical") {
      const newUrl = new URL(this.metadata.canonicalUrl || element.getAttribute("href"));
      element.setAttribute("href", newUrl.href);
      console.log(`Updated canonical URL:`, newUrl.href);
    }
  }
}
