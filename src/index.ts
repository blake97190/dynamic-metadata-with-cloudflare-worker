import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Worker started");
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
            return {
              title: "Default Title",
              description: "Default Description",
              image: "https://example.com/default-image.jpg",
              keywords: "default, keywords"
            };
          }
          
          console.log("Metadata fetched successfully:", metadata);
          return metadata;
        } catch (error) {
          console.error("Error in requestMetadata:", error);
          return {
            title: "Error Title",
            description: "An error occurred while fetching metadata",
            image: "https://example.com/error-image.jpg",
            keywords: "error, metadata"
          };
        }
      }

      const patternConfig = getPatternConfig(url.pathname);
      if (patternConfig) {
        console.log("Dynamic page detected:", url.pathname);
        let source = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source response headers:", Object.fromEntries(source.headers));

        const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
        console.log("Metadata fetched:", metadata);

        console.log("Applying metadata to HTML:");
        console.log("Title:", metadata.title);
        console.log("Description:", metadata.description);
        console.log("Image:", metadata.image);
        console.log("Keywords:", metadata.keywords);

        const customHeaderHandler = new CustomHeaderHandler(metadata);
        const transformedResponse = new HTMLRewriter()
          .on('*', customHeaderHandler)
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
      } else if (isPageData(url.pathname)) {
        console.log("Page data detected:", url.pathname);
        const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source data response headers:", Object.fromEntries(sourceResponse.headers));
        
        let sourceData = await sourceResponse.json();

        // Handle metadata for page data if needed
        const referer = request.headers.get('Referer');
        if (referer) {
          const refererUrl = new URL(referer);
          const patternConfigForPageData = getPatternConfig(refererUrl.pathname);
          if (patternConfigForPageData) {
            const metadata = await requestMetadata(refererUrl.pathname, patternConfigForPageData.metaDataEndpoint);
            console.log("Metadata fetched for page data:", metadata);

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

        const headers = new Headers({
          'Content-Type': 'application/json',
          'X-Worker-Executed': 'true',
          'Cache-Control': 'no-store, must-revalidate',
          'x-robots-tag': 'index, follow'
        });

        console.log("Final page data response headers:", Object.fromEntries(headers));
        return new Response(JSON.stringify(sourceData), { headers });
      }

      console.log("Fetching original content for:", url.pathname);
      const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
      const headers = new Headers(sourceResponse.headers);
      
      headers.set('X-Worker-Executed', 'true');
      headers.set('Cache-Control', 'no-store, must-revalidate');
      headers.set('x-robots-tag', 'index, follow');

      console.log("Final response headers:", Object.fromEntries(headers));

      return new Response(sourceResponse.body, {
        status: sourceResponse.status,
        statusText: sourceResponse.statusText,
        headers: headers
      });

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
      console.log(`Found meta tag: name=${name}, property=${property}`);
      
      if (name === "description" || property === "og:description" || name === "twitter:description") {
        console.log('Updating description meta tag');
        element.setAttribute("content", this.metadata.description);
      } else if (name === "keywords") {
        console.log('Updating keywords meta tag');
        element.setAttribute("content", this.metadata.keywords);
      } else if (name === "title" || property === "og:title" || name === "twitter:title") {
        console.log('Updating title meta tag');
        element.setAttribute("content", this.metadata.title);
      } else if (name === "image" || property === "og:image" || name === "twitter:image") {
        console.log('Updating image meta tag');
        element.setAttribute("content", this.metadata.image);
      } else if (name === "robots") {
        console.log('Updating robots meta tag');
        element.setAttribute("content", "index, follow");
      }
      
      console.log(`Updated meta tag content:`, element.getAttribute("content"));
    }
  }
}
