import React from 'react';
import { Logos3 } from '@/components/ui/logos3';
import { useContentText } from '@/contexts/ContentContext';

// Logos are self-hosted in /public/partners to avoid broken Wikimedia
// hotlinks (their hash-based paths change on re-upload). Re-fetch from
// commons.wikimedia.org/wiki/Special:FilePath/<file> if a logo needs updating.
const partnerLogos = [
  {
    id: "au",
    description: "African Union",
    image: "/partners/au.svg",
    className: "h-10 w-auto",
  },
  {
    id: "undp",
    description: "United Nations Development Programme",
    image: "/partners/undp.svg",
    className: "h-10 w-auto",
  },
  {
    id: "unicef",
    description: "UNICEF",
    image: "/partners/unicef.svg",
    className: "h-10 w-auto",
  },
  {
    id: "who",
    description: "World Health Organization",
    image: "/partners/who.svg",
    className: "h-10 w-auto",
  },
  {
    id: "worldbank",
    description: "World Bank",
    image: "/partners/worldbank.svg",
    className: "h-10 w-auto",
  },
  {
    id: "ilo",
    description: "International Labour Organization",
    image: "/partners/ilo.svg",
    className: "h-10 w-auto",
  },
  {
    id: "afdb",
    description: "African Development Bank",
    image: "/partners/afdb.svg",
    className: "h-10 w-auto",
  },
  {
    id: "unesco",
    description: "UNESCO",
    image: "/partners/unesco.svg",
    className: "h-10 w-auto",
  },
];

const Partners = () => {
  const heading = useContentText('home.partners.heading', 'Data Sources');
  return <Logos3 heading={heading} logos={partnerLogos} />;
};

export default Partners;
