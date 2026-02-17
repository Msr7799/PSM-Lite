/** @format */

const cheerio = require("cheerio");

async function testFetch(url, name) {
  console.log(`Testing with Full Headers: ${name}`);
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    };
    const res = await fetch(url, { headers, redirect: "follow" });
    console.log(`  Status: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $("title").text().trim();
    console.log(`  Title: ${title}`);
    if (html.includes("challenge")) console.log("  Likely Challenge Page");

    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (ogTitle) console.log(`  OG Title: ${ogTitle}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  console.log("---");
}

async function run() {
  const url =
    "https://www.booking.com/hotel/sa/narcissus-riyadh-hotel-spa.en-gb.html";
  await testFetch(url, "Full Headers");
}

run();
