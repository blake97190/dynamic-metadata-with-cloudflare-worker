import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Worker started");
      console.log("Request URL:", request.url);

      const url = new URL(request.url);
      const domainSource = config.domainSource;
      const patterns = config.patterns;

      // Skip processing for non-HTML files
      if (!url.pathname.endsWith('.html') && url.pathname !== '/') {
        console.log("Skipping non-HTML file:", url.pathname);
        return fetch(request);
      }

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
        
        if (metadata) {
          // Only modify the response if we successfully fetched metadata
          const customHeaderHandler = new CustomHeaderHandler(metadata);
          const transformedResponse = new HTMLRewriter()
            .on('title', customHeaderHandler)
            .on('meta', customHeaderHandler)
            .transform(source);

          const headers = new Headers(transformedResponse.headers);
          headers.set('X-Worker-Executed', 'true');
          headers.set('Cache-Control', 'no-store, must-revalidate');
          headers.set('x-robots-tag', 'index, follow');

          return new Response(transformedResponse.body, {
            status: transformedResponse.status,
            statusText: transformedResponse.statusText,
            headers: headers
          });
        }
      }

      // If we reach here, either it's not a dynamic page or metadata fetch failed
      // In either case, we return the original response
      console.log("Returning original response for:", url.pathname);
      return fetch(request);

    } catch (error) {
      console.error("Worker threw an exception:", error.message);
      console.error("Error stack:", error.stack);
      // In case of any error, fetch and return the original content
      return fetch(request);
    }
  }
};

class CustomHeaderHandler {
  constructor(metadata) {
    this.metadata = metadata;
  }

  element(element) {
    if (element.tagName === "title") {
      console.log('Found title tag, current content:', element.textContent);
      element.setInnerContent(this.metadata.title);
      console.log('Set new title content:', this.metadata.title);
    }
    if (element.tagName === "meta") {
      const name = element.getAttribute("name");
      const property = element.getAttribute("property");
      
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
      
      console.log(`Updated meta tag: ${name || property}, content: ${element.getAttribute("content")}`);
    }
  }
}
