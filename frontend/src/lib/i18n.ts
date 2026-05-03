import type { EventItem, Place, Village } from "../types/data";

export type Language = "en" | "ko" | "ja";
export type TranslationStatus = "idle" | "loading" | "ready" | "error";

export const LANGUAGE_STORAGE_KEY = "guamradar_language";
const TRANSLATION_CACHE_PREFIX = "guamradar_translate";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "ja", label: "日本語" },
];

const UI: Record<string, Record<Language, string>> = {
  mapTheme: { en: "Map Theme", ko: "지도 테마", ja: "マップテーマ" },
  language: { en: "Language", ko: "언어", ja: "言語" },
  music: { en: "Music", ko: "음악", ja: "音楽" },
  on: { en: "On", ko: "켜짐", ja: "オン" },
  off: { en: "Off", ko: "꺼짐", ja: "オフ" },
  default: { en: "Default", ko: "기본", ja: "標準" },
  dark: { en: "Dark", ko: "다크", ja: "ダーク" },
  night: { en: "Night", ko: "야간", ja: "ナイト" },
  myLocation: { en: "My location", ko: "내 위치", ja: "現在地" },
  hideMarkers: { en: "Hide markers", ko: "마커 숨기기", ja: "マーカーを非表示" },
  showMarkers: { en: "Show markers", ko: "마커 보이기", ja: "マーカーを表示" },
  hideVillageBorders: { en: "Hide village borders", ko: "마을 경계 숨기기", ja: "村の境界を非表示" },
  showVillageBorders: { en: "Show village borders", ko: "마을 경계 보이기", ja: "村の境界を表示" },
  settings: { en: "Settings", ko: "설정", ja: "設定" },
  tapToExplore: { en: "Tap to explore", ko: "탭하여 탐색", ja: "タップして探索" },
  youAreHere: { en: "You are here", ko: "현재 위치", ja: "現在地" },
  liveActivity: { en: "Live activity", ko: "실시간 활동", ja: "ライブアクティビティ" },
  recentCheckinsDemo: { en: "recent check-ins (demo)", ko: "최근 체크인(데모)", ja: "最近のチェックイン（デモ）" },
  explore: { en: "Explore", ko: "탐색", ja: "探索" },
  searchPlaceholder: { en: "Search places, events, beaches...", ko: "장소, 이벤트, 해변 검색...", ja: "場所、イベント、ビーチを検索..." },
  openNow: { en: "Open now", ko: "영업 중", ja: "営業中" },
  closedNow: { en: "Closed now", ko: "영업 종료", ja: "営業時間外" },
  hoursUnavailable: { en: "Hours unavailable", ko: "영업시간 정보 없음", ja: "営業時間情報なし" },
  nearMe: { en: "Near me", ko: "내 근처", ja: "近く" },
  reset: { en: "Reset", ko: "초기화", ja: "リセット" },
  nearMeNotice: { en: "Turned on Near me — tap My location on the map.", ko: "내 근처가 켜졌습니다 — 지도에서 내 위치 버튼을 누르세요.", ja: "近くがオンです — マップの現在地ボタンをタップしてください。" },
  results: { en: "Results", ko: "결과", ja: "結果" },
  items: { en: "items", ko: "개", ja: "件" },
  map: { en: "Map", ko: "지도", ja: "マップ" },
  villages: { en: "Villages", ko: "마을", ja: "村" },
  profile: { en: "Profile", ko: "프로필", ja: "プロフィール" },
  translationLoading: { en: "Translating...", ko: "번역 중...", ja: "翻訳中..." },
  translationError: { en: "Translation failed. Showing English fallback.", ko: "번역에 실패했습니다. 영어로 표시합니다.", ja: "翻訳に失敗しました。英語で表示します。" },
  details: { en: "Details", ko: "상세 정보", ja: "詳細" },
  noDetail: { en: "Click a marker or result to see details.", ko: "마커나 결과를 클릭하면 상세 정보가 표시됩니다.", ja: "マーカーまたは結果をクリックすると詳細が表示されます。" },
  directions: { en: "Directions", ko: "길찾기", ja: "経路" },
  savePoi: { en: "Save POI", ko: "장소 저장", ja: "スポットを保存" },
  removeSavedPoi: { en: "Remove saved POI", ko: "저장된 장소 제거", ja: "保存済みスポットを削除" },
  footerNote: { en: "Saved POIs, itinerary notes, sharing, and map highlighting enabled.", ko: "저장된 장소, 일정 메모, 공유, 지도 하이라이트가 활성화되어 있습니다.", ja: "保存済みスポット、旅程メモ、共有、マップ強調表示が有効です。" },
  browseByVillage: { en: "Browse by Village", ko: "마을별 둘러보기", ja: "村別に見る" },
  selectVillage: { en: "Select village", ko: "마을 선택", ja: "村を選択" },
  allVillages: { en: "All villages", ko: "전체 마을", ja: "すべての村" },
  noneInVillage: { en: "None in this village.", ko: "이 마을에는 없습니다.", ja: "この村にはありません。" },
  noResults: { en: "No results. Try resetting filters.", ko: "결과가 없습니다. 필터를 초기화해 보세요.", ja: "結果がありません。フィルターをリセットしてください。" },
  demoData: { en: "Demo Data", ko: "데모 데이터", ja: "デモデータ" },
  eventVerified: { en: "Event (Verified)", ko: "이벤트(확인됨)", ja: "イベント（確認済み）" },
  eventPending: { en: "Event (Pending)", ko: "이벤트(대기 중)", ja: "イベント（保留中）" },
  verified: { en: "Verified", ko: "확인됨", ja: "確認済み" },
  savedPlaces: { en: "Saved Places", ko: "저장된 장소", ja: "保存した場所" },
  noSavedPlaces: { en: "No saved places yet.", ko: "아직 저장된 장소가 없습니다.", ja: "保存した場所はまだありません。" },
  remove: { en: "Remove", ko: "제거", ja: "削除" },
  itineraries: { en: "Itineraries", ko: "여행 일정", ja: "旅程" },
  newItineraryTitle: { en: "New itinerary title", ko: "새 일정 제목", ja: "新しい旅程タイトル" },
  create: { en: "Create", ko: "만들기", ja: "作成" },
  noItineraries: { en: "No itineraries yet.", ko: "아직 일정이 없습니다.", ja: "旅程はまだありません。" },
  publicShareEnabled: { en: "Public share enabled", ko: "공개 공유 활성화", ja: "公開共有が有効" },
  private: { en: "Private", ko: "비공개", ja: "非公開" },
  copyShareLink: { en: "Copy share link", ko: "공유 링크 복사", ja: "共有リンクをコピー" },
  copySummary: { en: "Copy summary", ko: "요약 복사", ja: "概要をコピー" },
  emailItinerary: { en: "Email itinerary", ko: "일정 이메일 보내기", ja: "旅程をメール送信" },
  publicShare: { en: "Public", ko: "공개", ja: "公開" },
  showingOnMap: { en: "Showing on map", ko: "지도에 표시 중", ja: "マップに表示中" },
  emailSubjectPrefix: { en: "GuamRadar itinerary", ko: "GuamRadar 일정", ja: "GuamRadar旅程" },
  emailBodyIntro: { en: "Here is my GuamRadar itinerary", ko: "내 GuamRadar 일정입니다", ja: "私のGuamRadar旅程です" },
  addSelectedPlace: { en: "Add selected place", ko: "선택한 장소 추가", ja: "選択した場所を追加" },
  noPlacesYet: { en: "No places yet.", ko: "아직 장소가 없습니다.", ja: "場所はまだありません。" },
  day: { en: "Day", ko: "일차", ja: "日目" },
  notesForStop: { en: "Notes for this stop", ko: "이 장소에 대한 메모", ja: "この立ち寄り先のメモ" },
  up: { en: "Up", ko: "위로", ja: "上へ" },
  down: { en: "Down", ko: "아래로", ja: "下へ" },
  shareCopied: { en: "Share link copied.", ko: "공유 링크가 복사되었습니다.", ja: "共有リンクをコピーしました。" },
  sharedItinerary: { en: "Shared Itinerary", ko: "공유 일정", ja: "共有旅程" },
  noPlaces: { en: "No places.", ko: "장소가 없습니다.", ja: "場所がありません。" },
  signInSave: { en: "Sign in to save places and build itineraries.", ko: "장소를 저장하고 일정을 만들려면 로그인하세요.", ja: "場所を保存して旅程を作成するにはログインしてください。" },
  enterEmail: { en: "Enter your email", ko: "이메일 입력", ja: "メールアドレスを入力" },
  sending: { en: "Sending...", ko: "전송 중...", ja: "送信中..." },
  sendLoginLink: { en: "Send login link", ko: "로그인 링크 보내기", ja: "ログインリンクを送信" },
  previewSignedIn: { en: "Preview as signed-in user", ko: "로그인 사용자로 미리보기", ja: "ログイン済みユーザーとしてプレビュー" },
  signOut: { en: "Sign out", ko: "로그아웃", ja: "ログアウト" },
  demoAccount: { en: "Demo account", ko: "데모 계정", ja: "デモアカウント" },
  signedMagic: { en: "Signed in via magic link", ko: "매직 링크로 로그인됨", ja: "マジックリンクでログイン済み" },
  demoLocal: { en: "Demo mode — data is local only.", ko: "데모 모드 — 데이터는 로컬에만 저장됩니다.", ja: "デモモード — データはローカルのみです。" },
  loginLinkSent: { en: "Check your email for the login link.", ko: "로그인 링크를 이메일에서 확인하세요.", ja: "ログインリンクをメールで確認してください。" },
  loginFailed: { en: "Login failed.", ko: "로그인 실패.", ja: "ログインに失敗しました。" },
};

export function t(lang: Language, key: string) {
  return UI[key]?.[lang] ?? UI[key]?.en ?? key;
}

export const CATEGORY_LABELS: Record<string, Record<Language, string>> = {
  ALL: { en: "All", ko: "전체", ja: "すべて" },
  ATTRACTION: { en: "Attractions", ko: "관광지", ja: "観光地" },
  RESTAURANT: { en: "Restaurants", ko: "음식점", ja: "レストラン" },
  HOTEL: { en: "Hotels", ko: "호텔", ja: "ホテル" },
  SHOPPING: { en: "Shopping", ko: "쇼핑", ja: "ショッピング" },
  SERVICE: { en: "Services", ko: "서비스", ja: "サービス" },
  SCHOOL: { en: "Schools", ko: "학교", ja: "学校" },
  TRANSPORT: { en: "Transport", ko: "교통", ja: "交通" },
  BASE: { en: "Bases", ko: "군사 기지", ja: "基地" },
  HOSPITAL: { en: "Hospitals", ko: "병원", ja: "病院" },
  EVENT: { en: "Event", ko: "이벤트", ja: "イベント" },
  VERIFIED: { en: "Verified", ko: "확인됨", ja: "確認済み" },
  PENDING: { en: "Pending", ko: "대기 중", ja: "保留中" },
};

export function categoryLabel(value: string, lang: Language) {
  return CATEGORY_LABELS[value]?.[lang] ?? value;
}

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "ko" || saved === "ja" ? saved : "en";
}

function targetCode(lang: Language) {
  return lang === "ja" ? "ja" : "ko";
}

function cacheKey(lang: Language, id: string, field: string, text: string) {
  return `${TRANSLATION_CACHE_PREFIX}:${lang}:${id}:${field}:${text}`;
}

export async function translateTextCached(id: string, field: string, text: string | undefined, lang: Language) {
  const original = (text ?? "").trim();
  if (!original || lang === "en") return text ?? "";

  const key = cacheKey(lang, id, field, original);
  const cached = window.localStorage.getItem(key);
  if (cached) return cached;

  const target = targetCode(lang);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(original)}&langpair=en|${target}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Translation request failed");

  const data = await response.json();
  const translated = data?.responseData?.translatedText || original;
  window.localStorage.setItem(key, translated);
  return translated;
}

export async function translatePlacesToLanguage(places: Place[], lang: Language) {
  if (lang === "en") return places;
  return Promise.all(
    places.map(async (place) => ({
      ...place,
      name: await translateTextCached(place.id, "name", place.name, lang),
      description: await translateTextCached(place.id, "description", place.description, lang),
      hours: await translateTextCached(place.id, "hours", place.hours, lang),
      source: await translateTextCached(place.id, "source", place.source, lang),
    })),
  );
}

export async function translateEventsToLanguage(events: EventItem[], lang: Language) {
  if (lang === "en") return events;
  return Promise.all(
    events.map(async (event) => ({
      ...event,
      title: await translateTextCached(event.id, "title", event.title, lang),
      description: await translateTextCached(event.id, "description", event.description, lang),
      when: await translateTextCached(event.id, "when", event.when, lang),
      source: await translateTextCached(event.id, "source", event.source, lang),
    })),
  );
}

export async function translateVillagesToLanguage(villages: Village[], lang: Language) {
  if (lang === "en") return villages;
  return Promise.all(
    villages.map(async (village) => ({
      ...village,
      name: await translateTextCached(village.id, "name", village.name, lang),
    })),
  );
}
