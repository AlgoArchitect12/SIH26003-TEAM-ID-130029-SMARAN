import { Regions, type Region } from '../db/schema.types';
import imageCredits from './image-credits.json';

export const RegionalCategories = ['nature', 'tradition', 'craft', 'everyday', 'landmark'] as const;
export type RegionalCategory = (typeof RegionalCategories)[number];
export type RegionalContentItem = Readonly<{
  id: string;
  state: Region;
  category: RegionalCategory;
  title: string;
  shortDescription: string;
  detail: string;
  gentlePrompt: string;
  imageAsset: number;
  imageDescription: string;
  imageCredit: keyof typeof imageCredits;
  source: { organization: string; url: string };
}>;

// Editorial English copy. These are shared cultural subjects, never claims about a patient's life.
export const regionalItems: readonly RegionalContentItem[] = [
  {
    id: 'arunachal-ziro', state: 'arunachal', category: 'nature', title: 'Rice fields of Ziro',
    shortDescription: 'Green fields between the hills.',
    detail: 'Rice fields are part of the landscape of Ziro in Arunachal Pradesh. Apatani farmers practise rice and fish cultivation together here. Take a little time with the view: the fields, their edges and the hills beyond.',
    gentlePrompt: 'Do fields or a path through them bring anything to mind? There is no need to remember a name.',
    imageAsset: require('../../assets/my-home/arunachal-ziro.jpg'), imageDescription: 'Paddy fields at Ziro, Arunachal Pradesh.', imageCredit: 'arunachal-ziro',
    source: { organization: 'Arunachal Tourism', url: 'https://arunachaltourism.com/ziro-3/' },
  },
  {
    id: 'arunachal-tawang', state: 'arunachal', category: 'landmark', title: 'Tawang Monastery',
    shortDescription: 'A monastery on a hill above Tawang.',
    detail: 'Tawang Monastery is a Buddhist monastery in western Arunachal Pradesh. Founded in the seventeenth century, it is a place of religious and cultural life. In this photograph, you can pause with the buildings and the hills around them.',
    gentlePrompt: 'Is there a building or a quiet place you enjoy thinking about?',
    imageAsset: require('../../assets/my-home/arunachal-tawang.jpg'), imageDescription: 'Tawang Monastery in Arunachal Pradesh.', imageCredit: 'arunachal-tawang',
    source: { organization: 'Arunachal Tourism', url: 'https://arunachaltourism.com/spiritual-2/' },
  },
  {
    id: 'arunachal-weaving', state: 'arunachal', category: 'craft', title: 'Idu Mishmi weaving',
    shortDescription: 'Cloth taking shape on a backstrap loom.',
    detail: 'Idu Mishmi weavers in Arunachal Pradesh use backstrap looms to make patterned textiles. The photograph shows a weaver at work. You can follow the lines of the threads slowly, or simply enjoy looking at the cloth.',
    gentlePrompt: 'Does the sight of making something by hand feel familiar?',
    imageAsset: require('../../assets/my-home/arunachal-weaving.jpg'), imageDescription: 'An Idu Mishmi weaver working on a backstrap loom in Arunachal Pradesh.', imageCredit: 'arunachal-weaving',
    source: { organization: 'RIWATCH Museum and Research Institute', url: 'https://riwatch.in/community-to-community-weavers-interaction-programme/' },
  },
  {
    id: 'arunachal-sela', state: 'arunachal', category: 'nature', title: 'Sela Lake',
    shortDescription: 'Mountain water beside Sela Pass.',
    detail: 'Sela Lake lies beside the high mountain pass on the way to Tawang. The lake and its surroundings change with the seasons, and winter brings ice and snow. Here, you can enjoy a still view of the water and mountains.',
    gentlePrompt: 'Do mountain views bring a season or a journey to mind? It is also fine just to look.',
    imageAsset: require('../../assets/my-home/arunachal-sela.jpg'), imageDescription: 'Sela Lake in the mountains of Arunachal Pradesh.', imageCredit: 'arunachal-sela',
    source: { organization: 'Tawang District Administration', url: 'https://tawang.nic.in/tourism/' },
  },
  {
    id: 'assam-tea', state: 'assam', category: 'nature', title: 'Tea gardens',
    shortDescription: 'Rows of green tea plants in Assam.',
    detail: 'Tea gardens are a familiar part of many landscapes in Assam. Tea is grown and processed in the state. Look at the rows of plants in this photograph; there is no hurry to move on.',
    gentlePrompt: 'Does a tea garden, or the thought of a cup of tea, bring a moment to mind?',
    imageAsset: require('../../assets/my-home/assam-tea.jpg'), imageDescription: 'Tea gardens in Assam.', imageCredit: 'assam-tea',
    source: { organization: 'Department of Tourism, Government of Assam', url: 'https://tourism.assam.gov.in/portlet-sub-innerpage/tea-golf' },
  },
  {
    id: 'assam-bihu', state: 'assam', category: 'tradition', title: 'Rongali Bihu',
    shortDescription: 'Songs and dance to welcome spring.',
    detail: 'Rongali, or Bohag, Bihu is a spring celebration in Assam. Bihu songs and group dancing are part of the festivities. This photograph offers a moment with the dancers, their clothing and the sense of people gathering together.',
    gentlePrompt: 'Is there a song or a gathering you would like to think about?',
    imageAsset: require('../../assets/my-home/assam-bihu.jpg'), imageDescription: 'Bihu performers with traditional clothing and instruments in Assam.', imageCredit: 'assam-bihu',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.incredibleindia.gov.in/en/assam/dibrugarh' },
  },
  {
    id: 'assam-silk', state: 'assam', category: 'craft', title: 'Silk work in Sualkuchi',
    shortDescription: 'Threads prepared for woven cloth.',
    detail: 'Sualkuchi in Assam is known for silk weaving. Muga, paat and eri are among the silks associated with its weaving work. The photograph shows thread being prepared in Sualkuchi, one step in making a piece of cloth.',
    gentlePrompt: 'Does a favourite cloth, shawl or garment come to mind?',
    imageAsset: require('../../assets/my-home/assam-silk.jpg'), imageDescription: 'A woman preparing threads in Sualkuchi, Assam.', imageCredit: 'assam-silk',
    source: { organization: 'Department of Tourism, Government of Assam', url: 'https://tourism.assam.gov.in/portlet-sub-innerpage/rural-charm' },
  },
  {
    id: 'assam-masks', state: 'assam', category: 'craft', title: 'Mask making in Majuli',
    shortDescription: 'Handmade faces for a performing tradition.',
    detail: 'Majuli is a river island in Assam with satras, centres of worship and performing arts. Mask making is one of the crafts practised there. You can look at the shapes in this photograph without needing to recognise a character or a story.',
    gentlePrompt: 'Have you enjoyed watching someone make something? Any small thought is welcome.',
    imageAsset: require('../../assets/my-home/assam-masks.jpg'), imageDescription: 'Mask making in Majuli, Assam.', imageCredit: 'assam-masks',
    source: { organization: 'Department of Tourism, Government of Assam', url: 'https://tourism.assam.gov.in/portlet-sub-innerpage/satras-of-assam' },
  },
  {
    id: 'manipur-loktak', state: 'manipur', category: 'nature', title: 'Loktak Lake',
    shortDescription: 'Water and floating greenery.',
    detail: 'Loktak Lake in Manipur is known for floating masses of vegetation called phumdis. Water and greenery make a changing pattern across the lake. Let your eyes rest on the open water in this photograph.',
    gentlePrompt: 'Does the water remind you of a lake, a pond or a quiet afternoon?',
    imageAsset: require('../../assets/my-home/manipur-loktak.jpg'), imageDescription: 'Loktak Lake in Manipur.', imageCredit: 'manipur-loktak',
    source: { organization: 'Manipur Tourism', url: 'https://manipurtourism.gov.in/nature-and-wildlife/' },
  },
  {
    id: 'manipur-market', state: 'manipur', category: 'everyday', title: 'Ima Keithel',
    shortDescription: 'A market run by women in Imphal.',
    detail: 'Ima Keithel in Imphal is also called the Mothers’ Market. Women sell goods including food, textiles and handicrafts there. A market can hold many small details to notice: stalls, baskets, colours and people going about their day.',
    gentlePrompt: 'Does a market visit or an everyday purchase come to mind?',
    imageAsset: require('../../assets/my-home/manipur-market.jpg'), imageDescription: 'Ima Market in Imphal, Manipur.', imageCredit: 'manipur-market',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.incredibleindia.gov.in/en/manipur/imphal/imphal-travel-and-food-guide' },
  },
  {
    id: 'manipur-dance', state: 'manipur', category: 'tradition', title: 'Manipuri dance',
    shortDescription: 'A moment of music and graceful movement.',
    detail: 'Manipuri is a classical dance tradition that developed in Manipur. It includes Raas, known for its graceful movements and musical rhythm. The photograph shows a performance in the Manipuri style. You can enjoy its colours and shapes at your own pace.',
    gentlePrompt: 'Is there music or a performance you have enjoyed? You do not need to name it.',
    imageAsset: require('../../assets/my-home/manipur-dance.jpg'), imageDescription: 'A Raas performance in the Manipuri dance style.', imageCredit: 'manipur-dance',
    source: { organization: 'Centre for Cultural Resources and Training, Ministry of Culture', url: 'https://ccrtindia.gov.in/publication-and-audio-visual-productions/audio-visual-catalogue/' },
  },
  {
    id: 'manipur-pottery', state: 'manipur', category: 'craft', title: 'Longpi pottery',
    shortDescription: 'Dark pottery shaped by hand.',
    detail: 'Longpi pottery comes from Longpi Khullen and Longpi Kajui in Manipur. Makers use a mixture of ground stone and clay to form the pottery. In this photograph, take a moment to look at the vessels and their rounded shapes.',
    gentlePrompt: 'Does a pot, bowl or cup from everyday life come to mind?',
    imageAsset: require('../../assets/my-home/manipur-pottery.jpg'), imageDescription: 'Examples of Longpi pottery from Manipur.', imageCredit: 'manipur-pottery',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.prod.incredibleindia.gov.in/content/incredible-india-v2/en/destinations/imphal/pottery.html' },
  },
  {
    id: 'meghalaya-bridge', state: 'meghalaya', category: 'landmark', title: 'Living root bridges',
    shortDescription: 'Tree roots shaped into a crossing at Nongriat.',
    detail: 'At Nongriat in Meghalaya, living roots of rubber fig trees form a double-level bridge. These bridges are part of Khasi knowledge and local life. Notice how the roots meet and cross one another in the photograph.',
    gentlePrompt: 'Does a bridge or a path you know come to mind?',
    imageAsset: require('../../assets/my-home/meghalaya-bridge.jpg'), imageDescription: 'The double living root bridge at Nongriat, Meghalaya.', imageCredit: 'meghalaya-bridge',
    source: { organization: 'Meghalaya Tourism', url: 'https://www.meghalayatourism.in/explore/destinations/by-interest/living-root-bridges/nongriat/' },
  },
  {
    id: 'meghalaya-wangala', state: 'meghalaya', category: 'tradition', title: 'Wangala',
    shortDescription: 'A Garo harvest celebration with drums and dance.',
    detail: 'Wangala is a harvest festival of the Garo community. Drumming and group dancing are part of the celebration. This photograph was taken at a Wangala gathering in the Garo Hills of Meghalaya.',
    gentlePrompt: 'Does the thought of drums or a gathering bring any sound or feeling to mind?',
    imageAsset: require('../../assets/my-home/meghalaya-wangala.jpg'), imageDescription: 'Wangala dancers in the West Garo Hills, Meghalaya.', imageCredit: 'meghalaya-wangala',
    source: { organization: 'Meghalaya Tourism', url: 'https://www.meghalayatourism.in/explore/about-meghalaya/dance-music/wangala-dance/' },
  },
  {
    id: 'meghalaya-weaving', state: 'meghalaya', category: 'craft', title: 'Weaving in Meghalaya',
    shortDescription: 'Threads becoming cloth, a little at a time.',
    detail: 'Weaving is among the crafts practised in Meghalaya. Eri silk, also called ryndia in Khasi, is one of the textiles made here. The photograph shows weaving work; it is an invitation to notice the loom and threads, rather than identify a particular fabric.',
    gentlePrompt: 'Do the threads bring a colour or a piece of cloth to mind?',
    imageAsset: require('../../assets/my-home/meghalaya-weaving.jpg'), imageDescription: 'A weaver at a loom in Meghalaya.', imageCredit: 'meghalaya-weaving',
    source: { organization: 'Meghalaya Tourism', url: 'https://www.meghalayatourism.in/experiences/culture-&-lifestyle/local-life-&-leisure/local-crafts/' },
  },
  {
    id: 'meghalaya-umiam', state: 'meghalaya', category: 'nature', title: 'Umiam Lake',
    shortDescription: 'Open water framed by hills.',
    detail: 'Umiam Lake is a reservoir in Meghalaya, beside the route between Guwahati and Shillong. Hills surround the water. You can spend a quiet moment looking at the shoreline and the shapes of the hills in this view.',
    gentlePrompt: 'Does a view from a road or a window feel familiar?',
    imageAsset: require('../../assets/my-home/meghalaya-umiam.jpg'), imageDescription: 'Umiam Lake and its surrounding hills in Meghalaya.', imageCredit: 'meghalaya-umiam',
    source: { organization: 'Meghalaya Tourism', url: 'https://rc-www.meghalayatourism.in/destinations/umiam-lake/' },
  },
  {
    id: 'mizoram-reiek', state: 'mizoram', category: 'nature', title: 'Reiek hills',
    shortDescription: 'A green hill landscape in Mizoram.',
    detail: 'Reiek is a village and hill destination in Mizoram, near Aizawl. The surrounding hills are part of its landscape. Pause with this photograph and notice the outlines of the hills against the sky.',
    gentlePrompt: 'Do these hills bring a view from home or a journey to mind?',
    imageAsset: require('../../assets/my-home/mizoram-reiek.jpg'), imageDescription: 'Reiek hill in Mizoram.', imageCredit: 'mizoram-reiek',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.incredibleindia.gov.in/en/rural-tourism/reiek' },
  },
  {
    id: 'mizoram-cheraw', state: 'mizoram', category: 'tradition', title: 'Cheraw',
    shortDescription: 'Dancing between bamboo poles.',
    detail: 'Cheraw is a Mizo dance using long bamboo poles. Dancers step between the poles as others move them in rhythm. The photograph holds one moment of this group performance, so you can look at the steps and colours without any rush.',
    gentlePrompt: 'Does a dance or a familiar rhythm come to mind?',
    imageAsset: require('../../assets/my-home/mizoram-cheraw.jpg'), imageDescription: 'A Cheraw bamboo dance performance.', imageCredit: 'mizoram-cheraw',
    source: { organization: 'Aizawl District Administration', url: 'https://aizawl.nic.in/tourism/' },
  },
  {
    id: 'mizoram-puan', state: 'mizoram', category: 'craft', title: 'Puan cloth',
    shortDescription: 'Woven cloth in Mizo everyday and festive life.',
    detail: 'Puan is the Mizo word for cloth. Woven wraparound garments are part of Mizo clothing, and decorated textiles are worn for celebrations. The photograph offers a glimpse of weaving work. Take a moment to look at the threads coming together.',
    gentlePrompt: 'Does a colour or a garment you like come to mind?',
    imageAsset: require('../../assets/my-home/mizoram-puan.jpg'), imageDescription: 'Mizo weaving work.', imageCredit: 'mizoram-puan',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.incredibleindia.gov.in/en/mizoram/mizo-puanchei' },
  },
  {
    id: 'mizoram-chapchar', state: 'mizoram', category: 'tradition', title: 'Chapchar Kut',
    shortDescription: 'A spring gathering in Mizoram.',
    detail: 'Chapchar Kut is a Mizo spring festival linked with a pause after clearing fields for jhum cultivation. Dance and festive clothing are part of the gathering. Here is a glimpse of the celebration, to enjoy in your own time.',
    gentlePrompt: 'Does a spring day or a community gathering bring anything to mind?',
    imageAsset: require('../../assets/my-home/mizoram-chapchar.jpg'), imageDescription: 'A glimpse of a Chapchar Kut celebration.', imageCredit: 'mizoram-chapchar',
    source: { organization: 'Directorate of Information and Public Relations, Mizoram', url: 'https://dipr.mizoram.gov.in/page/festivals' },
  },
  {
    id: 'nagaland-dzukou', state: 'nagaland', category: 'nature', title: 'Dzükou Valley',
    shortDescription: 'Rolling green slopes and open sky.',
    detail: 'Dzükou Valley lies along the Nagaland–Manipur border. Its landscape includes rolling meadows, streams and seasonal flowers. Take a moment with the green slopes in this photograph, and notice how one hill leads gently into the next.',
    gentlePrompt: 'Does a green hillside bring a place or a season to mind?',
    imageAsset: require('../../assets/my-home/nagaland-dzukou.jpg'), imageDescription: 'Green slopes of Dzükou Valley along the Nagaland–Manipur border.', imageCredit: 'nagaland-dzukou',
    source: { organization: 'Department of Tourism, Nagaland', url: 'https://tourism.nagaland.gov.in/where-the-clouds-rest-discovering-the-magic-of-dzukou-valley/' },
  },
  {
    id: 'nagaland-hornbill', state: 'nagaland', category: 'tradition', title: 'Hornbill Festival',
    shortDescription: 'Different communities sharing performances and crafts.',
    detail: 'The Hornbill Festival at Kisama brings together cultural performances and crafts from communities of Nagaland. The photograph shows Zeliang performers rehearsing a dance. Each community has its own traditions; one picture can offer only a small glimpse.',
    gentlePrompt: 'Does watching a group perform bring a gathering to mind?',
    imageAsset: require('../../assets/my-home/nagaland-hornbill.jpg'), imageDescription: 'Zeliang performers rehearsing at the Hornbill Festival in Nagaland.', imageCredit: 'nagaland-hornbill',
    source: { organization: 'Department of Tourism, Nagaland', url: 'https://tourism.nagaland.gov.in/hornbill2022/' },
  },
  {
    id: 'nagaland-shawl', state: 'nagaland', category: 'craft', title: 'Woven shawls',
    shortDescription: 'Cloth made by local weavers.',
    detail: 'Handwoven shawls are among the textiles made and sold in Nagaland. This photograph shows one example of a shawl. You can enjoy the arrangement of colours without needing to know a pattern name or its meaning.',
    gentlePrompt: 'Does a shawl or a cloth you have enjoyed wearing come to mind?',
    imageAsset: require('../../assets/my-home/nagaland-shawl.jpg'), imageDescription: 'An example of a Naga shawl from Nagaland.', imageCredit: 'nagaland-shawl',
    source: { organization: 'Ministry of Tourism, Incredible India', url: 'https://www.incredibleindia.gov.in/en/nagaland/kohima/artistic-expressions-of-kohima' },
  },
  {
    id: 'nagaland-morung', state: 'nagaland', category: 'landmark', title: 'Morungs at Kisama',
    shortDescription: 'Traditional building forms in a heritage village.',
    detail: 'Kisama Heritage Village has buildings called morungs, representing different communities of Nagaland. The heritage complex brings these building traditions together in one place. Notice the roof and entrance in this photograph.',
    gentlePrompt: 'Does a roof, a doorway or a place where people meet feel familiar?',
    imageAsset: require('../../assets/my-home/nagaland-morung.jpg'), imageDescription: 'A morung at Kisama Heritage Village, Nagaland.', imageCredit: 'nagaland-morung',
    source: { organization: 'Department of Tourism, Nagaland', url: 'https://tourism.nagaland.gov.in/hornbill2022/about.html' },
  },
  {
    id: 'sikkim-tsomgo', state: 'sikkim', category: 'nature', title: 'Tsomgo Lake',
    shortDescription: 'A mountain lake that changes with the seasons.',
    detail: 'Tsomgo, also called Changu, is a mountain lake in Sikkim. Melting mountain snow feeds the water, and the lake can freeze in winter. Pause with the photograph and notice the meeting of water, mountain and sky.',
    gentlePrompt: 'Does a lake or a cool mountain day come to mind?',
    imageAsset: require('../../assets/my-home/sikkim-tsomgo.jpg'), imageDescription: 'Tsomgo Lake in Sikkim.', imageCredit: 'sikkim-tsomgo',
    source: { organization: 'Gangtok District Administration', url: 'https://gangtokdistrict.nic.in/tourist-place/changu-lake/' },
  },
  {
    id: 'sikkim-rumtek', state: 'sikkim', category: 'landmark', title: 'Rumtek Monastery',
    shortDescription: 'A Buddhist monastery in the hills near Gangtok.',
    detail: 'Rumtek Monastery stands in the hills facing Gangtok in Sikkim. It is a centre of the Kagyu tradition of Tibetan Buddhism. Look at the building in this photograph, or simply take a quiet moment before continuing.',
    gentlePrompt: 'Is there a place where you like to sit quietly?',
    imageAsset: require('../../assets/my-home/sikkim-rumtek.jpg'), imageDescription: 'Rumtek Monastery in Sikkim.', imageCredit: 'sikkim-rumtek',
    source: { organization: 'Gangtok District Administration', url: 'https://gangtokdistrict.nic.in/tourist-place/rumtek-monastery/' },
  },
  {
    id: 'sikkim-carpet', state: 'sikkim', category: 'craft', title: 'Carpet weaving',
    shortDescription: 'Patient handwork, thread by thread.',
    detail: 'Carpet weaving is one of the established handicrafts of Sikkim. Weavers make patterned carpets by hand. This photograph offers a closer look at a finished carpet. Notice the colours and the shapes along its border.',
    gentlePrompt: 'Does a woven rug or a handmade object bring anything to mind?',
    imageAsset: require('../../assets/my-home/sikkim-carpet.jpg'), imageDescription: 'A woven carpet from Sikkim.', imageCredit: 'sikkim-carpet',
    source: { organization: 'Commerce and Industries Department, Sikkim', url: 'https://industries.sikkim.gov.in/visitors/psusdetails/7' },
  },
  {
    id: 'sikkim-temi', state: 'sikkim', category: 'everyday', title: 'Tea from Temi',
    shortDescription: 'Tea growing on a gentle hill slope.',
    detail: 'Temi Tea Garden in Sikkim grows tea on slopes below Tendong Hill. Tea leaves are processed at the estate. The photograph shows the garden where this everyday drink begins, among rows of green plants.',
    gentlePrompt: 'Does the thought of tea bring a taste, a smell or a shared moment to mind?',
    imageAsset: require('../../assets/my-home/sikkim-temi.jpg'), imageDescription: 'Temi Tea Garden in Sikkim.', imageCredit: 'sikkim-temi',
    source: { organization: 'Namchi District Administration', url: 'https://namchi.nic.in/tourist-place/temi-tea-garden/' },
  },
  {
    id: 'tripura-neermahal', state: 'tripura', category: 'landmark', title: 'Neermahal',
    shortDescription: 'A palace in Rudrasagar Lake.',
    detail: 'Neermahal is a former summer palace set in Rudrasagar Lake in Tripura. Its name means water palace. Look at its walls and the water around it; this is a view to enjoy without needing to recall dates or names.',
    gentlePrompt: 'Does a building beside water bring a place or a visit to mind?',
    imageAsset: require('../../assets/my-home/tripura-neermahal.jpg'), imageDescription: 'Neermahal palace in Rudrasagar Lake, Tripura.', imageCredit: 'tripura-neermahal',
    source: { organization: 'Tripura Tourism Development Corporation', url: 'https://tripuratourism.gov.in/images/documents/1731059147.pdf' },
  },
  {
    id: 'tripura-hojagiri', state: 'tripura', category: 'tradition', title: 'Hojagiri dance',
    shortDescription: 'A dance tradition of the Reang community.',
    detail: 'Hojagiri is a dance associated with the Reang community of Tripura. Music accompanies the dancers and their movements. This photograph offers one moment of the performance, to look at without any need to take part.',
    gentlePrompt: 'Does a dance or a tune you have enjoyed come to mind?',
    imageAsset: require('../../assets/my-home/tripura-hojagiri.jpg'), imageDescription: 'Gestures in a Hojagiri dance performance.', imageCredit: 'tripura-hojagiri',
    source: { organization: 'Indira Gandhi National Centre for the Arts, Ministry of Culture', url: 'https://ignca.gov.in/hi/divisionss/media-centre/outreach/published-dvds/the-multifarious-tribal-culture-of-tripura-reangs-and-other-tribes-of-tripura/' },
  },
  {
    id: 'tripura-bamboo', state: 'tripura', category: 'craft', title: 'Bamboo handicrafts',
    shortDescription: 'Bamboo shaped into everyday and decorative objects.',
    detail: 'Artisans in Tripura use bamboo and cane to make many objects, including mats, baskets, fans and furniture. The photograph shows a decorative bamboo craft from Tripura. Take a moment to notice its small pieces and careful arrangement.',
    gentlePrompt: 'Does a handmade object from home come to mind?',
    imageAsset: require('../../assets/my-home/tripura-bamboo.jpg'), imageDescription: 'A decorative bamboo handicraft from Tripura.', imageCredit: 'tripura-bamboo',
    source: { organization: 'West Tripura District Administration', url: 'https://westtripura.nic.in/handicraft/' },
  },
  {
    id: 'tripura-ujjayanta', state: 'tripura', category: 'landmark', title: 'Ujjayanta Palace',
    shortDescription: 'A familiar landmark in Agartala.',
    detail: 'Ujjayanta Palace stands in Agartala and houses Tripura’s state museum. The former palace is one of the city’s cultural landmarks. You can pause with this view of the building and its grounds.',
    gentlePrompt: 'Does a building, a garden or a day in town come to mind?',
    imageAsset: require('../../assets/my-home/tripura-ujjayanta.jpg'), imageDescription: 'Ujjayanta Palace in Agartala, Tripura.', imageCredit: 'tripura-ujjayanta',
    source: { organization: 'West Tripura District Administration', url: 'https://westtripura.nic.in/tourism/' },
  },
];

export function isRegionalState(state: unknown): state is Region {
  return typeof state === 'string' && Regions.some(region => region === state);
}

export function getRegionalPack(state: unknown): readonly RegionalContentItem[] {
  return isRegionalState(state) ? regionalItems.filter(item => item.state === state) : [];
}

export function getRegionalItem(id: unknown): RegionalContentItem | undefined {
  return typeof id === 'string' ? regionalItems.find(item => item.id === id) : undefined;
}

export function getItemsByCategory(state: unknown, category: RegionalCategory): readonly RegionalContentItem[] {
  return getRegionalPack(state).filter(item => item.category === category);
}

export { imageCredits };
