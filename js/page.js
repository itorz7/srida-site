// Inner pages (product lines, articles, 404): shared behaviour plus the article contents list.
import { initSite, trackSections } from './site.js';

initSite();
trackSections(new Map([...document.querySelectorAll('.toc a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a])));
