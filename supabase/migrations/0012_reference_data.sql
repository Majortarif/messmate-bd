-- =============================================================================
-- MessMate BD · 0012 · Reference data (needed in production, not demo data)
--   * Dhaka areas (approximate centre points for the map)
--   * National helplines — numbers checked against public sources on 2026-10-23
--   * Major public hospitals — names/locations only; phone numbers are left
--     empty on purpose until verified. In an emergency call 999.
--   * Easy budget recipes for bachelors
-- =============================================================================

insert into public.areas (slug, name_bn, name_en, lat, lng, sort_order) values
  ('mirpur',        'মিরপুর',         'Mirpur',         23.822300, 90.365400, 1),
  ('uttara',        'উত্তরা',          'Uttara',         23.875900, 90.379500, 2),
  ('dhanmondi',     'ধানমন্ডি',        'Dhanmondi',      23.746100, 90.374200, 3),
  ('mohammadpur',   'মোহাম্মদপুর',     'Mohammadpur',    23.766200, 90.358900, 4),
  ('badda',         'বাড্ডা',          'Badda',          23.780500, 90.426700, 5),
  ('rampura',       'রামপুরা',         'Rampura',        23.761200, 90.419600, 6),
  ('banasree',      'বনশ্রী',          'Banasree',       23.763600, 90.434400, 10),
  ('aftabnagar',    'আফতাবনগর',       'Aftabnagar',     23.768500, 90.444600, 11),
  ('bashundhara',   'বসুন্ধরা',         'Bashundhara',    23.819300, 90.452600, 12),
  ('khilkhet',      'খিলক্ষেত',        'Khilkhet',       23.829700, 90.421700, 13),
  ('kuril',         'কুড়িল',           'Kuril',          23.817000, 90.421000, 14),
  ('banani',        'বনানী',           'Banani',         23.794000, 90.404300, 15),
  ('gulshan',       'গুলশান',          'Gulshan',        23.780600, 90.416600, 16),
  ('mohakhali',     'মহাখালী',         'Mohakhali',      23.778100, 90.398600, 17),
  ('tejgaon',       'তেজগাঁও',         'Tejgaon',        23.763900, 90.392500, 18),
  ('farmgate',      'ফার্মগেট',        'Farmgate',       23.758000, 90.389700, 19),
  ('kawran-bazar',  'কারওয়ান বাজার',   'Kawran Bazar',   23.751000, 90.393500, 20),
  ('kalabagan',     'কলাবাগান',        'Kalabagan',      23.746900, 90.382000, 21),
  ('shyamoli',      'শ্যামলী',          'Shyamoli',       23.774500, 90.365700, 22),
  ('agargaon',      'আগারগাঁও',        'Agargaon',       23.778200, 90.380000, 23),
  ('moghbazar',     'মগবাজার',         'Moghbazar',      23.748900, 90.404400, 24),
  ('malibagh',      'মালিবাগ',         'Malibagh',       23.748700, 90.412300, 25),
  ('shantinagar',   'শান্তিনগর',        'Shantinagar',    23.740000, 90.414000, 26),
  ('khilgaon',      'খিলগাঁও',         'Khilgaon',       23.751600, 90.425500, 27),
  ('shahbag',       'শাহবাগ',          'Shahbag',        23.738000, 90.395800, 28),
  ('azimpur',       'আজিমপুর',         'Azimpur',        23.726200, 90.385700, 29),
  ('lalbagh',       'লালবাগ',          'Lalbagh',        23.719000, 90.388000, 30),
  ('motijheel',     'মতিঝিল',          'Motijheel',      23.733000, 90.417200, 31),
  ('old-dhaka',     'পুরান ঢাকা',       'Old Dhaka',      23.710400, 90.407400, 32),
  ('wari',          'ওয়ারী',           'Wari',           23.718300, 90.420600, 33),
  ('jatrabari',     'যাত্রাবাড়ী',       'Jatrabari',      23.710400, 90.434900, 34),
  ('mugda',         'মুগদা',           'Mugda',          23.730000, 90.430000, 35),
  ('cantonment',    'ক্যান্টনমেন্ট',     'Cantonment',     23.820000, 90.400000, 36)
on conflict (slug) do nothing;

-- ------------------------------------------------------------- helplines -----
insert into public.emergency_places (kind, name_bn, name_en, phone, is_24h, notes, website, verified_on, source_url, sort_order) values
  ('helpline', 'জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)', 'National Emergency Service (police, fire, ambulance)',
   '999', true, 'টোল-ফ্রি। যেকোনো জরুরি অবস্থায় প্রথমে এই নম্বরে কল করুন।', null, '2026-10-23',
   'https://en.prothomalo.com/bangladesh/coronavirus-where-to-call-if-you-need-emergency-services', 1),
  ('fire_service', 'ফায়ার সার্ভিস নিয়ন্ত্রণ কক্ষ (ঢাকা)', 'Fire Service & Civil Defence control room (Dhaka)',
   '16163', true, 'কাজ না করলে ৯৯৯ এ কল করুন।', null, '2026-10-23',
   'https://thefinancialexpress.com.bd/national/fire-service-launches-hotline-1641904693', 2),
  ('helpline', 'ফোনে ডাক্তারের পরামর্শ (সরকারি স্বাস্থ্য বাতায়ন)', 'Government health advice line (doctor on phone)',
   '16263', true, 'কল করে ০ চাপলে ডাক্তারের সাথে কথা বলা যায়।', null, '2026-10-23',
   'https://mirzarcharup.narsingdi.gov.bd/en/site/page/ফোনে-ডাক্তারের-সেবা', 3),
  ('helpline', 'নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন', 'Helpline for violence against women and children',
   '109', true, 'টোল-ফ্রি, ২৪ ঘণ্টা।', null, '2026-10-23',
   'https://en.prothomalo.com/bangladesh/coronavirus-where-to-call-if-you-need-emergency-services', 4),
  ('helpline', 'সরকারি তথ্য ও সেবা বাতায়ন', 'Government information and services line',
   '333', true, null, null, '2026-10-23',
   'https://en.prothomalo.com/bangladesh/coronavirus-where-to-call-if-you-need-emergency-services', 5),
  ('mental_health', 'কান পেতে রই (মানসিক সহায়তা ও আত্মহত্যা প্রতিরোধ)', 'Kaan Pete Roi (emotional support, suicide prevention)',
   '09612119911', false, 'প্রশিক্ষিত স্বেচ্ছাসেবকরা গোপনীয়ভাবে কথা শোনেন। সময়: বিকাল ৩টা–রাত ৩টা (ওয়েবসাইটে সর্বশেষ সময় দেখে নিন)।',
   'https://kaanpeteroi.org', '2026-10-23', 'https://lifeline-international.com/?p=2624', 6);

-- ------------------------------------------------------------- hospitals -----
insert into public.emergency_places (kind, name_bn, name_en, area_id, address, lat, lng, is_24h, notes, sort_order)
select v.kind::public.place_kind, v.name_bn, v.name_en, a.id, v.address, v.lat, v.lng, true,
       'জরুরি বিভাগ চালু থাকে। ফোন নম্বর যাচাই করে যোগ করা হবে — জরুরি হলে ৯৯৯ এ কল করুন।', v.sort_order
  from (values
    ('hospital', 'ঢাকা মেডিকেল কলেজ হাসপাতাল', 'Dhaka Medical College Hospital', 'shahbag', 'বকশীবাজার, ঢাকা', 23.725600, 90.397600, 10),
    ('hospital', 'বাংলাদেশ মেডিকেল বিশ্ববিদ্যালয় (সাবেক বিএসএমএমইউ)', 'Bangladesh Medical University (former BSMMU)', 'shahbag', 'শাহবাগ, ঢাকা', 23.738900, 90.394600, 11),
    ('hospital', 'শহীদ সোহরাওয়ার্দী মেডিকেল কলেজ হাসপাতাল', 'Shaheed Suhrawardy Medical College Hospital', 'agargaon', 'শেরেবাংলা নগর, ঢাকা', 23.769700, 90.371300, 12),
    ('hospital', 'জাতীয় অর্থোপেডিক হাসপাতাল (পঙ্গু হাসপাতাল)', 'NITOR (National Institute of Traumatology & Orthopaedic Rehabilitation)', 'agargaon', 'শেরেবাংলা নগর, ঢাকা', 23.771300, 90.369900, 13),
    ('mental_health', 'জাতীয় মানসিক স্বাস্থ্য ইনস্টিটিউট ও হাসপাতাল', 'National Institute of Mental Health', 'agargaon', 'শেরেবাংলা নগর, ঢাকা', 23.773800, 90.371700, 14),
    ('hospital', 'কুর্মিটোলা জেনারেল হাসপাতাল', 'Kurmitola General Hospital', 'cantonment', 'ঢাকা ক্যান্টনমেন্ট', 23.819700, 90.405400, 15),
    ('hospital', 'কুয়েত-বাংলাদেশ মৈত্রী সরকারি হাসপাতাল', 'Kuwait Bangladesh Friendship Govt. Hospital', 'uttara', 'সেক্টর ৩১, উত্তরা', 23.873100, 90.400600, 16),
    ('hospital', 'মুগদা মেডিকেল কলেজ হাসপাতাল', 'Mugda Medical College Hospital', 'mugda', 'মুগদা, ঢাকা', 23.730700, 90.433300, 17),
    ('hospital', 'স্যার সলিমুল্লাহ মেডিকেল কলেজ (মিটফোর্ড) হাসপাতাল', 'Sir Salimullah Medical College (Mitford) Hospital', 'old-dhaka', 'মিটফোর্ড, পুরান ঢাকা', 23.710500, 90.402500, 18)
  ) as v(kind, name_bn, name_en, area_slug, address, lat, lng, sort_order)
  join public.areas a on a.slug = v.area_slug;

-- ---------------------------------------------------------------- recipes -----
insert into public.recipes (title_bn, title_en, description, ingredients, steps, equipment, cook_minutes, servings,
                            cost_estimate, is_budget, is_sick_friendly, status) values
  ('রাইস কুকারে ডিম খিচুড়ি', 'Rice-cooker egg khichuri',
   'এক পাত্রে পুরো খাবার। বাজার না থাকলেও চলে।',
   'চাল ১/২ কাপ, মসুর ডাল ১/৪ কাপ, ডিম ২টি, পেঁয়াজ ১টি, কাঁচামরিচ ২-৩টি, হলুদ ১/২ চা চামচ, লবণ, তেল ১ টেবিল চামচ, পানি ২.৫ কাপ',
   E'১. চাল আর ডাল একসাথে ধুয়ে নিন।\n২. রাইস কুকারে তেল দিয়ে পেঁয়াজ কুচি আর মরিচ ২-৩ মিনিট নাড়ুন (cook মোডে)।\n৩. চাল-ডাল, হলুদ, লবণ আর পানি দিয়ে ঢাকনা বন্ধ করুন।\n৪. warm মোডে চলে গেলে ডিম ভেঙে উপরে দিয়ে ৫ মিনিট ঢেকে রাখুন।\n৫. নেড়ে গরম গরম খেয়ে নিন।',
   'rice_cooker', 35, 2, 70, true, false, 'approved'),
  ('আলু ভর্তা আর ডিম সেদ্ধ', 'Mashed potato and boiled egg',
   'ভাত রান্নার সাথেই হয়ে যায়, আলাদা চুলা লাগে না।',
   'আলু ২টি, ডিম ১-২টি, পেঁয়াজ ১টি, শুকনা মরিচ ২টি, সরিষার তেল ১ চা চামচ, লবণ',
   E'১. ভাত রান্নার সময় ধোয়া আলু আর ডিম চালের উপর বসিয়ে দিন।\n২. ভাত হলে আলু আর ডিমের খোসা ছাড়ান।\n৩. শুকনা মরিচ হালকা সেঁকে নিন।\n৪. আলু, পেঁয়াজ কুচি, মরিচ, লবণ আর সরিষার তেল দিয়ে মাখুন।',
   'rice_cooker', 25, 1, 35, true, false, 'approved'),
  ('পাতলা মসুর ডাল', 'Simple masoor dal',
   'প্রতিদিনের সবচেয়ে সস্তা প্রোটিন।',
   'মসুর ডাল ১/২ কাপ, হলুদ ১/৪ চা চামচ, লবণ, পেঁয়াজ ১টি, রসুন ২ কোয়া, কাঁচামরিচ ২টি, তেল ১ টেবিল চামচ, পানি ৩ কাপ',
   E'১. ডাল ধুয়ে হলুদ, লবণ আর পানি দিয়ে সেদ্ধ করুন (১৫ মিনিট)।\n২. ডাল ঘুটনি বা চামচ দিয়ে মিহি করে নিন।\n৩. আলাদা কড়াইতে তেলে পেঁয়াজ-রসুন ভেজে ডালে ঢেলে দিন।\n৪. কাঁচামরিচ দিয়ে ২ মিনিট ফুটিয়ে নামান।',
   'stove', 25, 3, 40, true, true, 'approved'),
  ('ডিম ভুনা', 'Egg bhuna',
   'মাছ-মাংস ছাড়া দুপুরের ভালো তরকারি।',
   'ডিম ৪টি, পেঁয়াজ ২টি, টমেটো ১টি, আদা-রসুন বাটা ১ চা চামচ, হলুদ-মরিচ গুঁড়া ১/২ চা চামচ করে, লবণ, তেল ২ টেবিল চামচ',
   E'১. ডিম সেদ্ধ করে খোসা ছাড়িয়ে হালকা ছুরি দিয়ে দাগ কাটুন।\n২. তেলে পেঁয়াজ লাল করে ভাজুন।\n৩. আদা-রসুন, মসলা আর একটু পানি দিয়ে কষান।\n৪. টমেটো দিয়ে নরম হলে ডিম দিন, ৫ মিনিট ঢেকে রান্না করুন।',
   'stove', 30, 2, 90, true, false, 'approved'),
  ('চিড়া-দই-কলা', 'Chira, yogurt and banana',
   'সকালে তাড়াহুড়ায় রান্না ছাড়াই পেট ভরা নাস্তা।',
   'চিড়া ১ কাপ, টক দই বা দুধ ১/২ কাপ, পাকা কলা ১টি, চিনি বা গুড় স্বাদমতো',
   E'১. চিড়া ধুয়ে ২ মিনিট ভিজিয়ে পানি ঝরিয়ে নিন।\n২. দই, কলা আর গুড় দিয়ে মেখে খেয়ে নিন।',
   'no_cook', 5, 1, 50, true, false, 'approved'),
  ('কেটলিতে সবজি নুডলস', 'Kettle vegetable noodles',
   'শুধু ইলেকট্রিক কেটলি থাকলেও গরম খাবার।',
   'ইনস্ট্যান্ট নুডলস ১ প্যাক, গাজর ও বাঁধাকপি কুচি এক মুঠো, কাঁচামরিচ ১টি',
   E'১. কেটলিতে পানি ফুটিয়ে নিন।\n২. বাটিতে নুডলস আর সবজি কুচি রেখে ফুটন্ত পানি ঢালুন।\n৩. প্লেট দিয়ে ঢেকে ৪ মিনিট রাখুন।\n৪. পানি একটু ঝরিয়ে মসলা মিশিয়ে খান।',
   'kettle', 8, 1, 40, true, false, 'approved'),
  ('জাউ ভাত (অসুস্থ দিনের খাবার)', 'Rice porridge (jau) for sick days',
   'জ্বর বা পেটের সমস্যায় সহজে হজম হয়।',
   'চাল ১/৪ কাপ, পানি ২ কাপ, লবণ এক চিমটি',
   E'১. চাল ধুয়ে বেশি পানি দিয়ে রাইস কুকারে দিন।\n২. মাঝে মাঝে নেড়ে নরম, ঘন না হওয়া পর্যন্ত রান্না করুন।\n৩. লবণ দিয়ে গরম গরম খান। চাইলে একটু আলু ভর্তা পাশে রাখুন।',
   'rice_cooker', 30, 1, 15, true, true, 'approved'),
  ('আদা-লেবু-মধু চা', 'Ginger, lemon and honey tea',
   'ঠান্ডা-কাশি আর গলা ব্যথায় আরাম দেয়।',
   'আদা কুচি ১ চা চামচ, লেবু অর্ধেক, মধু ১ চা চামচ, গরম পানি ১ কাপ',
   E'১. কেটলিতে পানি ফোটান।\n২. কাপে আদা কুচি রেখে গরম পানি ঢেলে ৫ মিনিট ঢেকে রাখুন।\n৩. একটু ঠান্ডা হলে লেবুর রস আর মধু মিশিয়ে চুমুক দিন।',
   'kettle', 7, 1, 20, true, true, 'approved');
