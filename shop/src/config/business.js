/**
 * Happy Mart — Business Configuration
 * Edit this file to change all content, colors, services, and images on the site.
 * Every component reads from here. No hardcoded content anywhere else.
 */

const business = {
  name: "Happy Mart",
  tagline: "Happy Mart — Super Market",
  businessType: "neighbourhood grocery store",
  description:
    "Happy Mart is the go-to grocery stop for the Kochuvila neighbourhood, conveniently located on NH 66 opposite Alamcode Juma Masjid. We stock everything a family needs for their day-to-day shopping — from staples and packaged goods to fresh vegetables and household essentials. Our shelves are regularly replenished, and we take care to keep seasonal produce like mushrooms in stock for our regulars.",

  location: {
    city: "Kochuvila",
    area: "NH 66, opposite Alamcode Juma Masjid",
    address: "Opposite Alamcode Juma Masjid, NH 66, Kochuvila, Alamcode P.O., Thiruvananthapuram, Kerala 695102",
    googleMapsLink:
      "https://maps.google.com/?cid=1863261730478802673&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
  },

  phone: "09746898547",
  whatsapp: "09746898547",
  email: null, // no email provided

  hours: [
    { day: "Monday – Saturday", time: "9:00 AM – 9:00 PM" },
    { day: "Sunday", time: "9:00 AM – 9:30 PM" },
  ],

  heroImage: "/images/hero.jpg",

  aboutImage: "/images/hero.jpg",

  services: [
    {
      title: "Grocery Essentials",
      description: "Staples, packaged goods, and every day-to-day household item you need.",
      image: "/images/service1.jpg",
      alt: "Interior of Happy Mart showing well-stocked grocery shelves and aisles",
    },
    {
      title: "Fresh Vegetables & Produce",
      description: "Regularly stocked fresh vegetables, including mushrooms — a local favourite.",
      image: "/images/service2.jpg",
      alt: "Fresh vegetables and produce section at Happy Mart",
    },
    {
      title: "Household & Personal Care",
      description: "Cleaning supplies, toiletries, and personal care products for the whole family.",
      image: "/images/service3.jpg",
      alt: "Household and personal care products aisle at Happy Mart",
    },
  ],

  usps: [
    {
      icon: "📍",
      title: "Right on NH 66",
      description: "Conveniently located opposite Alamcode Juma Masjid — your easiest stop on the way home.",
    },
    {
      icon: "🕐",
      title: "Open Late Every Day",
      description: "From 9 AM to 9 PM on weekdays, and until 9:30 PM on Sundays.",
    },
    {
      icon: "🥬",
      title: "Fresh Produce, Always",
      description: "Vegetables stocked regularly, with seasonal items like mushrooms for our regulars.",
    },
    {
      icon: "🏠",
      title: "Your Neighbourhood Stop",
      description: "The primary shop for daily essentials in Kochuvila — no need to travel far.",
    },
  ],

  // No testimonials provided — section will be omitted
  testimonials: [],

  faq: [
    {
      question: "What are your opening hours?",
      answer: "We're open Monday through Saturday from 9:00 AM to 9:00 PM, and on Sundays from 9:00 AM to 9:30 PM.",
    },
    {
      question: "Do you stock fresh vegetables?",
      answer: "Yes — we carry a regular supply of fresh vegetables, including mushrooms, which customers often mention in reviews.",
    },
    {
      question: "Where are you located?",
      answer: "We're on NH 66 in Kochuvila, opposite Alamcode Juma Masjid, near Quality Cars. Easy to spot on your daily commute.",
    },
    {
      question: "Can I call in my order?",
      answer: "Absolutely. Give us a call at 09746898547 and we'll have your items ready for pickup.",
    },
  ],

  ctas: {
    primary: { text: "Visit Us", href: "https://maps.google.com/?cid=1863261730478802673&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA" },
    secondary: { text: "Contact Us", href: "#contact" },
  },

  /** DESIGN TOKENS — override any of these to re-theme the site */
  design: {
    brandStyle: "Minimal",
    primaryColor: "#2D6A4F", // warm, earthy green
    primaryLight: "#40916C",
    primaryDark: "#1B4332",
    secondaryColor: "#F5F5F0", // soft warm light gray
    ink: "#1A1A1A", // near-black
    inkLight: "#4A4A4A",
    offWhite: "#FAFAF8",
    lightNeutral: "#F0F0EB",
    white: "#FFFFFF",
    accent: "#2D6A4F",
    fontHeading: "'Fraunces', Georgia, serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
};

export default business;
