/**
 * Privacy Policy and Terms of Use in plain language (Bangla + English).
 * Bump TERMS_VERSION in src/lib/constants.ts whenever the meaning changes,
 * so every user is asked to accept the new version.
 * This text is a sensible starting point, not legal advice.
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

const privacyBn: LegalDoc = {
  title: "গোপনীয়তা নীতি",
  intro:
    "MessMate BD ঢাকার ব্যাচেলরদের মেস, টাকা-পয়সা আর দৈনন্দিন জীবন সহজ করার জন্য বানানো। আপনার কোন তথ্য আমরা রাখি, কেন রাখি আর কে দেখতে পারে — নিচে সহজ ভাষায় লেখা আছে।",
  sections: [
    {
      heading: "আমরা কী তথ্য রাখি",
      body: [
        "অ্যাকাউন্ট: নাম, ইমেইল, পাসওয়ার্ড (এনক্রিপ্ট করা অবস্থায়, আমরা দেখতে পারি না), ঐচ্ছিকভাবে মোবাইল নম্বর ও প্রোফাইল ছবি।",
        "মেসের হিসাব: কোন মেসের সদস্য, রুম, মিলের অর্ডার, টাকা জমার অনুরোধ (পরিমাণ, বিকাশ/নগদ/রকেটের TrxID, পাঠানোর নম্বর), বিল, বাজার খরচ ও মাসিক হিসাব।",
        "আপনি নিজে যা যোগ করেন: অভিযোগ, নোটিশ, ভোট, বাসা/সিটের বিজ্ঞাপন (ছবি ও আপনার দেওয়া ম্যাপের পিন সহ), রুমমেট প্রোফাইল (বাজেট, অভ্যাস, পছন্দের এলাকা), বেচাকেনার পোস্ট, সার্ভিসের তথ্য, রিভিউ, ইভেন্ট ও টিউশন পোস্ট।",
        "কেয়ার ফিচার (শুধু আপনি ব্যবহার করলে): মুড চেক-ইন, অসুস্থ/SOS বার্তা, নিরাপদে পৌঁছানোর চেক-ইন, জরুরি যোগাযোগের নম্বর, রিমাইন্ডার, পানি ও বাড়িতে ফোনের হিসাব, ধার-দেনা আর ব্যক্তিগত বাজেট।",
        "লোকেশন: শুধু তখনই, যখন আপনি নিজে অসুস্থ/SOS বার্তায় লোকেশন দেন বা নিজের বিজ্ঞাপনে ম্যাপে পিন বসান। আমরা আপনার অবস্থান পেছন থেকে ট্র্যাক করি না।",
      ],
    },
    {
      heading: "কেন রাখি",
      body: [
        "মিল, বিল আর ওয়ালেটের হিসাব সঠিকভাবে চালাতে, মেসের সদস্যদের মধ্যে নোটিশ ও রিমাইন্ডার পাঠাতে, প্রতারণা ও অপব্যবহার ঠেকাতে, আর অ্যাপটি উন্নত করতে।",
        "আমরা আপনার তথ্য বিক্রি করি না এবং বিজ্ঞাপনদাতাদের সাথে শেয়ার করি না।",
      ],
    },
    {
      heading: "কে কী দেখতে পারে",
      body: [
        "আপনার মেসের সদস্যরা: আপনার নাম, ছবি, ফোন নম্বর, রুম ও মেসের সাধারণ তথ্য (মেনু, নোটিশ, বাজার খরচ)।",
        "মেস ম্যানেজার: উপরের সব, সাথে আপনার ওয়ালেট লেনদেন, মিল অর্ডার ও টাকা জমার অনুরোধ — যাতে হিসাব মিলিয়ে নিতে পারেন।",
        "অন্য মেস: কিছুই না। প্রতিটি মেসের তথ্য ডাটাবেস স্তরে (Row Level Security) আলাদা করা।",
        "কেয়ার তথ্য (মুড, স্বাস্থ্য, রিমাইন্ডার, ধার, চেক-ইন): শুধু আপনি। অসুস্থ বা SOS বার্তা কেবল তারাই দেখেন যাদের কাছে আপনি পাঠান। ম্যানেজার বা প্ল্যাটফর্ম অ্যাডমিনও এগুলো দেখতে পারেন না।",
        "মেসের অভিযোগ, ভোট, নোটিশ আর দায়িত্বের রোস্টার মেসের সবাই দেখতে পান।",
        "সাইন-ইন করা অন্য ব্যবহারকারীরা: আপনি যা প্রকাশ করেন (বাসার বিজ্ঞাপন ও তার ফোন নম্বর, বেচাকেনা, সার্ভিস, ইভেন্ট, টিউশন পোস্ট, রিভিউ)। এসব জায়গায় তারা আপনার পুরো প্রোফাইল না দেখে ছোট নাম দেখেন (যেমন “রাফি আ.”)।",
        "রুমমেট ম্যাচ: একই লিঙ্গের যারা রুমমেট খুঁজছেন তারা আপনার রুমমেট প্রোফাইল দেখেন; ফোন নম্বর কেবল আপনি চালু করলে।",
        "প্ল্যাটফর্ম অ্যাডমিন (যারা MessMate BD চালান): সাপোর্ট ও অপব্যবহার ঠেকাতে অ্যাকাউন্টের মূল তথ্য (নাম, ইমেইল, ফোন), মেসের নাম ও সদস্যপদ, আপনার পাঠানো ফিডব্যাক আর টাকা ও সদস্যপদ পরিবর্তনের কার্যক্রম লগ দেখতে পারেন। কেয়ার তথ্য দেখতে পারেন না।",
      ],
    },
    {
      heading: "টাকা-পয়সা সম্পর্কে",
      body: [
        "MessMate BD নিজে কোনো টাকা লেনদেন করে না। আপনি ম্যানেজারকে বিকাশ/নগদ/রকেট/নগদে টাকা দেন, অ্যাপে শুধু তার হিসাব রাখা হয় এবং ম্যানেজার TrxID মিলিয়ে অনুমোদন করেন।",
      ],
    },
    {
      heading: "তথ্য কোথায় থাকে, কতদিন থাকে",
      body: [
        "তথ্য Supabase (PostgreSQL) সার্ভারে নিরাপদে রাখা হয়, সংযোগ সবসময় এনক্রিপ্টেড (HTTPS)।",
        "অ্যাকাউন্ট থাকা পর্যন্ত তথ্য থাকে। পড়া নোটিফিকেশন ৯০ দিন পর নিজে থেকে মুছে যায়।",
      ],
    },
    {
      heading: "আপনার অধিকার",
      body: [
        "সেটিংস → প্রোফাইল থেকে যেকোনো সময় নিজের তথ্য বদলাতে পারবেন।",
        "সেটিংস থেকে নিজের সব তথ্য ডাউনলোড (export) করতে পারবেন।",
        "অ্যাকাউন্ট মুছে ফেললে আপনার ব্যক্তিগত তথ্য, কেয়ার তথ্য, পোস্ট ও যোগাযোগ মুছে যায়। তবে মেসের টাকার হিসাব (লেনদেন ও মাসিক স্টেটমেন্ট) নাম ছাড়া রেখে দেওয়া হয়, কারণ মেসের বাকি সদস্যদের হিসাব মেলাতে সেটা দরকার।",
      ],
    },
    {
      heading: "কুকি",
      body: ["শুধু লগইন ধরে রাখতে প্রয়োজনীয় কুকি এবং ভাষা/থিমের পছন্দ ব্রাউজারে রাখা হয়। কোনো বিজ্ঞাপন বা ট্র্যাকিং কুকি নেই।"],
    },
    {
      heading: "বয়স",
      body: ["MessMate BD ১৬ বছরের কম বয়সীদের জন্য নয়।"],
    },
    {
      heading: "পরিবর্তন ও যোগাযোগ",
      body: [
        "নীতিতে বড় পরিবর্তন হলে অ্যাপে জানানো হবে এবং আবার সম্মতি চাওয়া হবে।",
        "প্রশ্ন বা অভিযোগ থাকলে অ্যাপের ফিডব্যাক অপশন বা নিচের ইমেইলে লিখুন।",
      ],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  intro:
    "MessMate BD helps bachelors in Dhaka run their mess, money and daily life. This page explains, in plain language, what we store, why, and who can see it.",
  sections: [
    {
      heading: "What we store",
      body: [
        "Account: name, email, password (encrypted — we can't read it), and optionally a mobile number and profile photo.",
        "Mess records: which mess you belong to, your room, meal orders, deposit requests (amount, bKash/Nagad/Rocket TrxID, sender number), bills, bazar expenses and monthly statements.",
        "Things you add: complaints, notices, votes, housing listings (with photos and a map pin you place), a roommate profile (budget, habits, preferred areas), marketplace posts, service suggestions, reviews, events and tuition posts.",
        "Care features (only if you use them): mood check-ins, sick/SOS messages, reached-home check-ins, emergency contacts, reminders, water and call-home logs, loan records and a personal budget.",
        "Location: only when you add it yourself to a sick/SOS alert or place a pin on your own listing. We never track your location in the background.",
      ],
    },
    {
      heading: "Why",
      body: [
        "To keep meal, bill and wallet records correct, to send notices and reminders inside your mess, to prevent fraud and abuse, and to improve the app.",
        "We do not sell your data or share it with advertisers.",
      ],
    },
    {
      heading: "Who can see what",
      body: [
        "Your messmates: your name, photo, phone number, room, and shared mess information (menus, notices, bazar costs).",
        "Your mess manager: all of the above plus your wallet transactions, meal orders and deposit requests, so they can keep the accounts straight.",
        "Other messes: nothing. Each mess is isolated at the database level (Row Level Security).",
        "Care data (mood, health, reminders, loans, check-ins): only you. Sick and SOS messages are seen only by the people you send them to. Managers and platform admins cannot read them.",
        "Mess complaints, polls, notices and the duty roster are visible to everyone in your mess.",
        "Other signed-in users: what you choose to publish (listings and their contact number, marketplace items, services, events, tuition posts, reviews). There they see a short name such as “Rafi A.”, not your full profile.",
        "Roommate matching: people of the same gender who are also looking see your roommate profile; your phone number only if you turn it on.",
        "Platform admins (the people running MessMate BD): for support and abuse prevention they can see account basics (name, email, phone), mess names and membership, feedback you send, and an activity log of money and membership changes. They cannot see Care data.",
      ],
    },
    {
      heading: "About money",
      body: [
        "MessMate BD never moves money. You pay your manager by bKash, Nagad, Rocket or cash; the app only records it, and the manager approves it after checking the TrxID.",
      ],
    },
    {
      heading: "Where data lives and for how long",
      body: [
        "Data is stored on Supabase (PostgreSQL) servers, and every connection is encrypted (HTTPS).",
        "We keep data while your account exists. Read notifications are deleted automatically after 90 days.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "Edit your information any time under Settings → Profile.",
        "Download (export) all of your data from Settings.",
        "Deleting your account removes your personal data, Care data, posts and contacts. Your mess money records (transactions and monthly statements) are kept without your name, because the rest of the mess needs them to balance.",
      ],
    },
    {
      heading: "Cookies",
      body: ["Only the cookies needed to keep you signed in, plus your language and theme choice in your browser. No advertising or tracking cookies."],
    },
    {
      heading: "Age",
      body: ["MessMate BD is not meant for anyone under 16."],
    },
    {
      heading: "Changes and contact",
      body: [
        "If this policy changes in a meaningful way we will tell you in the app and ask for your consent again.",
        "Questions or complaints: use the in-app feedback option or the email below.",
      ],
    },
  ],
};

const termsBn: LegalDoc = {
  title: "ব্যবহারের শর্তাবলি",
  intro: "MessMate BD ব্যবহার করে আপনি নিচের শর্তগুলো মেনে নিচ্ছেন। সহজ কথায়: সৎ থাকুন, অন্যকে সম্মান করুন, আর নিজের হিসাব নিজে মিলিয়ে নিন।",
  sections: [
    {
      heading: "সেবাটি কী",
      body: [
        "MessMate BD মেসের মিল, বাজার, বিল ও ওয়ালেটের হিসাব রাখার, বাসা/রুমমেট খোঁজার, স্থানীয় সার্ভিস ও বেচাকেনার এবং একা থাকা ব্যাচেলরদের পাশে থাকার একটি প্ল্যাটফর্ম।",
        "অ্যাপটি কোনো টাকা লেনদেন করে না এবং কোনো ব্যাংক বা মোবাইল ব্যাংকিং সেবা নয়।",
      ],
    },
    {
      heading: "আপনার অ্যাকাউন্ট",
      body: [
        "সঠিক নাম ও তথ্য দিন, পাসওয়ার্ড গোপন রাখুন। আপনার অ্যাকাউন্টে যা হয় তার দায় আপনার।",
        "একজন ব্যবহারকারী একসাথে একটি মেসের সদস্য থাকতে পারেন।",
      ],
    },
    {
      heading: "ম্যানেজারের দায়িত্ব",
      body: [
        "ম্যানেজার সদস্যদের টাকা জমা অনুমোদন, মেনু, বাজার খরচ ও বিল সঠিকভাবে লিখবেন। প্রতিটি পরিবর্তন অডিট লগে থাকে।",
        "টাকা গ্রহণ ও ফেরতের বিষয়টি সদস্য ও ম্যানেজারের মধ্যে; MessMate BD শুধু হিসাব রাখার মাধ্যম।",
      ],
    },
    {
      heading: "যা করা যাবে না",
      body: [
        "ভুয়া TrxID দেওয়া, অন্যের অ্যাকাউন্ট ব্যবহার, প্রতারণামূলক বিজ্ঞাপন, হয়রানি, ঘৃণামূলক বা অবৈধ কনটেন্ট পোস্ট করা।",
        "অ্যাপের নিরাপত্তা ভাঙার চেষ্টা বা স্বয়ংক্রিয়ভাবে তথ্য সংগ্রহ (scraping) করা।",
      ],
    },
    {
      heading: "বাসা, সার্ভিস ও বেচাকেনা",
      body: [
        "বিজ্ঞাপন ও সার্ভিস তালিকা ব্যবহারকারীদের দেওয়া। আমরা যাচাই করার চেষ্টা করি, কিন্তু নিশ্চয়তা দিই না।",
        "বাসা নিজে দেখে, চুক্তি পড়ে তারপর অগ্রিম দিন। জিনিস হাতে না দেখে টাকা পাঠাবেন না।",
      ],
    },
    {
      heading: "জরুরি অবস্থা",
      body: [
        "কেয়ার ফিচার (অসুস্থ মোড, SOS, চেক-ইন) বন্ধু ও মেসমেটদের জানানোর একটি সহায়ক উপায় মাত্র — এটি জরুরি সেবার বিকল্প নয়। বিপদে সবসময় ৯৯৯ এ কল করুন।",
        "ইন্টারনেট, নোটিফিকেশন বা সার্ভার সমস্যার কারণে বার্তা দেরিতে পৌঁছাতে বা না পৌঁছাতে পারে।",
      ],
    },
    {
      heading: "কনটেন্ট ও মডারেশন",
      body: [
        "আপনার পোস্ট করা কনটেন্টের মালিক আপনি, তবে অ্যাপে দেখানোর অনুমতি আমাদের দিচ্ছেন।",
        "শর্ত ভঙ্গ হলে পোস্ট সরানো বা অ্যাকাউন্ট বন্ধ করা হতে পারে।",
      ],
    },
    {
      heading: "দায়বদ্ধতার সীমা",
      body: [
        "অ্যাপটি যেমন আছে তেমন অবস্থায় দেওয়া হচ্ছে। হিসাবের ভুল, ব্যবহারকারীদের মধ্যে লেনদেন বা বিরোধ, বা সেবা সাময়িক বন্ধ থাকার কারণে হওয়া ক্ষতির দায় আইনে যতটুকু অনুমোদিত তার বেশি আমরা নিই না।",
      ],
    },
    {
      heading: "পরিবর্তন ও আইন",
      body: [
        "শর্তে বড় পরিবর্তন হলে অ্যাপে জানানো হবে এবং আবার সম্মতি চাওয়া হবে।",
        "এই শর্তাবলি বাংলাদেশের আইন অনুযায়ী পরিচালিত।",
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  title: "Terms of Use",
  intro: "By using MessMate BD you agree to these terms. In short: be honest, respect others, and check your own accounts.",
  sections: [
    {
      heading: "What the service is",
      body: [
        "MessMate BD is a platform to keep a mess's meal, bazar, bill and wallet records, find housing and roommates, use local services and a marketplace, and support bachelors who live alone.",
        "The app never moves money and is not a bank or mobile banking service.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "Use your real name and details and keep your password secret. You are responsible for what happens in your account.",
        "A user can belong to one mess at a time.",
      ],
    },
    {
      heading: "Managers",
      body: [
        "Managers approve deposits and record menus, bazar costs and bills accurately. Every change is kept in an audit log.",
        "Collecting and returning money is between members and their manager; MessMate BD is only the record-keeping tool.",
      ],
    },
    {
      heading: "Not allowed",
      body: [
        "Fake TrxIDs, using someone else's account, fraudulent listings, harassment, hateful or illegal content.",
        "Trying to break the app's security or scraping data automatically.",
      ],
    },
    {
      heading: "Housing, services and marketplace",
      body: [
        "Listings and services come from users. We try to verify them but cannot guarantee them.",
        "Visit the place and read the agreement before paying an advance. Don't send money for items you haven't seen.",
      ],
    },
    {
      heading: "Emergencies",
      body: [
        "Care features (sick mode, SOS, check-ins) are a helpful way to alert friends and messmates — they are not a substitute for emergency services. In danger, always call 999.",
        "Messages may be delayed or not delivered because of network, notification or server problems.",
      ],
    },
    {
      heading: "Content and moderation",
      body: [
        "You own what you post, and you allow us to show it in the app.",
        "Posts may be removed or accounts suspended if these terms are broken.",
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        "The app is provided as is. To the extent the law allows, we are not liable for losses caused by record errors, transactions or disputes between users, or temporary outages.",
      ],
    },
    {
      heading: "Changes and law",
      body: [
        "If these terms change in a meaningful way we will tell you in the app and ask for your consent again.",
        "These terms are governed by the laws of Bangladesh.",
      ],
    },
  ],
};

export const legalDocs = {
  privacy: { bn: privacyBn, en: privacyEn },
  terms: { bn: termsBn, en: termsEn },
} as const;
