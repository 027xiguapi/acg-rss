import "dotenv/config";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  anime,
  animeEpisodes,
  animeInfos,
  episodeInfos,
  torrentItems,
  users,
  type User,
} from "./schema";
import { hashPassword } from "../server/auth/password";

/* ---------------------------------------------------------------- helpers */

const DAY_MS = 86_400_000;

/** Timestamp `n` days in the past (fractional values allowed). */
const daysAgo = (n: number): Date => new Date(Date.now() - n * DAY_MS);

/** Deterministic dedup key for a torrent — stable across re-runs. */
const sha1 = (value: string): string =>
  createHash("sha1").update(value).digest("hex");

const magnetOf = (title: string): string =>
  `magnet:?xt=urn:btih:${sha1(title)}&dn=${encodeURIComponent(title)}`;

const torrentUrlOf = (title: string): string =>
  `https://example.com/torrents/${sha1(title)}.torrent`;

/** Labeled placeholder images so the demo covers render offline-ish. */
const poster = (text: string, color: string): string =>
  `https://placehold.co/400x600/${color}/ffffff/png?text=${encodeURIComponent(text)}`;

const still = (text: string): string =>
  `https://placehold.co/640x360/334155/ffffff/png?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------ seed types */

/** Parsed metadata of one demo torrent. Linked torrents inherit
 * season/episode from their parent anime/episode rows. */
type SeedTorrent = {
  title: string;
  subgroup: string | null;
  resolution: string | null;
  size: number | null;
  daysAgo: number;
  category?: string;
  description?: string;
  animeTitle?: string;
  season?: number | null;
  episode?: number | null;
};

type SeedEpisode = {
  number: number;
  /** Multilingual info rows (title/synopsis) for episode_infos */
  contents?: { lang: string; title: string | null; content: string | null }[];
  coverUrl: string | null;
  daysAgo: number;
  torrents: SeedTorrent[];
};

type SeedAnime = {
  /** Which demo account owns the entry. */
  owner: "demo" | "alice";
  title: string;
  season: number;
  year: number | null;
  /** JP | CN | HK | TW | KR | WEST | OTHER */
  origin: string | null;
  /** ISO weekday 1=Mon … 7=Sun; null → "unscheduled" section */
  airDay: number | null;
  /** TV | MOVIE | OVA | ONA | SPECIAL | OTHER */
  type: string | null;
  coverUrl: string | null;
  /** PLANNED | WATCHING | PAUSED | COMPLETED | DROPPED */
  watchStatus: string;
  createdDaysAgo: number;
  synonyms: { lang: string | null; title: string }[];
  episodes: SeedEpisode[];
  /** Torrents whose title has no episode number: linked to the anime only. */
  unparsedTorrents?: SeedTorrent[];
};

/** Weekly-episode skeleton used for shows that get no per-episode detail. */
function plainEpisodes(
  count: number,
  firstDaysAgo: number,
  stepDays = 7
): SeedEpisode[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    coverUrl: null,
    daysAgo: firstDaysAgo - i * stepDays,
    torrents: [],
  }));
}

/* ------------------------------------------------------------ demo dataset
 *
 * Eleven series chosen to cover every weekday section (plus the
 * "unscheduled" one), all origins in use, the main work types and all
 * watch statuses — some with covers, some without (gradient fallback).
 */

const DEMO_ANIME: SeedAnime[] = [
  {
    owner: "demo",
    title: "Sousou no Frieren",
    season: 1,
    year: 2023,
    origin: "JP",
    airDay: 5,
    type: "TV",
    coverUrl: poster("Frieren", "16a34a"),
    watchStatus: "WATCHING",
    createdDaysAgo: 120,
    synonyms: [
      { lang: "ja", title: "葬送のフリーレン" },
      { lang: "en", title: "Frieren: Beyond Journey's End" },
      { lang: "zh-Hans", title: "葬送的芙莉莲" },
    ],
    episodes: [
      {
        number: 1,
        contents: [
          {
            lang: "zh-CN",
            title: "冒险的终点",
            content:
              "打倒了魔王的勇者一行回到了王都。在庆典的烟花下，漫长旅程的终点也悄然临近。",
          },
          {
            lang: "ja",
            title: "冒険の終わり",
            content:
              "魔王を倒した勇者一行は王都へと帰還した。祝祭の花火の下、長い旅の終わりが静かに近づいていた。",
          },
        ],
        coverUrl: still("EP 01"),
        daysAgo: 37,
        torrents: [],
      },
      {
        number: 2,
        contents: [
          {
            lang: "zh-CN",
            title: null,
            content:
              "辛美尔的死让芙莉莲意识到自己对人类的了解多么浅薄。她踏上前往魂魄安眠之地的旅途。",
          },
        ],
        coverUrl: still("EP 02"),
        daysAgo: 30,
        torrents: [],
      },
      { number: 3, coverUrl: null, daysAgo: 23, torrents: [] },
      {
        number: 4,
        coverUrl: null,
        daysAgo: 16,
        torrents: [
          {
            title:
              "[LoliHouse] Sousou no Frieren - 04 [WebRip 1080p HEVC-10bit AAC][简繁内嵌]",
            subgroup: "LoliHouse",
            resolution: "1080p",
            size: 466_124_864,
            daysAgo: 16,
            category: "动画",
            description: "仅供参考学习，请于下载后 24 小时内删除。",
          },
          {
            title:
              "[SubsPlease] Frieren - Beyond Journey's End - 04 (1080p) [AB12CD34].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 471_859_200,
            daysAgo: 15,
            category: "Anime",
          },
        ],
      },
      {
        number: 5,
        coverUrl: null,
        daysAgo: 9,
        torrents: [
          {
            title:
              "[ANi] 葬送のフリーレン - 05 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 486_539_264,
            daysAgo: 9,
            category: "動畫",
          },
          {
            title:
              "[SubsPlease] Frieren - Beyond Journey's End - 05 (1080p) [CD34EF56].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 469_762_048,
            daysAgo: 8,
            category: "Anime",
          },
        ],
      },
      {
        number: 6,
        coverUrl: null,
        daysAgo: 2,
        torrents: [
          {
            title:
              "[LoliHouse] Sousou no Frieren - 06 [WebRip 1080p HEVC-10bit AAC][简繁内嵌]",
            subgroup: "LoliHouse",
            resolution: "1080p",
            size: 462_422_016,
            daysAgo: 2,
            category: "动画",
          },
          {
            title:
              "[ANi] 葬送のフリーレン - 06 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 490_209_280,
            daysAgo: 1,
            category: "動畫",
          },
          {
            title:
              "[SubsPlease] Frieren - Beyond Journey's End - 06 (1080p) [EF56AB78].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 475_734_016,
            daysAgo: 1,
            category: "Anime",
          },
        ],
      },
    ],
  },
  {
    owner: "demo",
    title: "Kimetsu no Yaiba",
    season: 1,
    year: 2019,
    origin: "JP",
    airDay: 7,
    type: "TV",
    coverUrl: poster("Kimetsu", "dc2626"),
    watchStatus: "WATCHING",
    createdDaysAgo: 200,
    synonyms: [
      { lang: "ja", title: "鬼滅の刃" },
      { lang: "en", title: "Demon Slayer: Kimetsu no Yaiba" },
      { lang: "zh-Hans", title: "鬼灭之刃" },
    ],
    episodes: [
      {
        number: 1,
        coverUrl: null,
        daysAgo: 24,
        torrents: [
          {
            title: "[SubsPlease] Kimetsu no Yaiba - 01 (1080p) [12AB34CD].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 524_288_000,
            daysAgo: 24,
            category: "Anime",
          },
        ],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 17,
        torrents: [
          {
            title:
              "[LoliHouse] 鬼滅の刃 - 02 [WebRip 1080p HEVC-10bit AAC][简繁内嵌]",
            subgroup: "LoliHouse",
            resolution: "1080p",
            size: 492_830_720,
            daysAgo: 17,
            category: "动画",
          },
        ],
      },
      {
        number: 3,
        coverUrl: null,
        daysAgo: 10,
        torrents: [
          {
            title: "[ANi] 鬼滅の刃 - 03 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 481_267_712,
            daysAgo: 10,
            category: "動畫",
          },
        ],
      },
      {
        number: 4,
        coverUrl: null,
        daysAgo: 3,
        torrents: [
          {
            title: "[SubsPlease] Kimetsu no Yaiba - 04 (1080p) [34CD56EF].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 494_927_872,
            daysAgo: 3,
            category: "Anime",
          },
        ],
      },
    ],
  },
  {
    owner: "alice",
    title: "Bocchi the Rock!",
    season: 1,
    year: 2022,
    origin: "JP",
    airDay: 1,
    type: "TV",
    coverUrl: poster("Bocchi", "db2777"),
    watchStatus: "COMPLETED",
    createdDaysAgo: 150,
    synonyms: [
      { lang: "ja", title: "ぼっち・ざ・ろっく！" },
      { lang: "zh-Hans", title: "孤独摇滚！" },
    ],
    episodes: plainEpisodes(12, 100).map((ep, i) =>
      i === 0
        ? {
            ...ep,
            contents: [
              {
                lang: "zh-CN",
                title: null,
                content:
                  "阴沉的吉他少女后藤一里，在街头偶遇了想组建乐队的伊地知虹夏。",
              },
            ],
          }
        : ep
    ),
  },
  {
    owner: "demo",
    title: "Oshi no Ko",
    season: 2,
    year: 2024,
    origin: "JP",
    airDay: 3,
    type: "TV",
    coverUrl: poster("Oshi no Ko", "be123c"),
    watchStatus: "WATCHING",
    createdDaysAgo: 60,
    synonyms: [
      { lang: "ja", title: "推しの子" },
      { lang: "en", title: "Oshi no Ko 2nd Season" },
      { lang: "zh-Hans", title: "我推的孩子" },
    ],
    episodes: [
      {
        number: 1,
        contents: [
          {
            lang: "zh-CN",
            title: null,
            content:
              "「东京BLADE」的舞台开演在即，阿库亚与黑川茜各自面对着不同的难题。",
          },
        ],
        coverUrl: still("EP 01"),
        daysAgo: 18,
        torrents: [
          {
            title:
              "[ANi] 【推しの子】Second Season - 01 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 511_705_088,
            daysAgo: 18,
            category: "動畫",
          },
          {
            title: "[SubsPlease] Oshi no Ko S2 - 01 (1080p) [90ABCDEF].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 486_539_264,
            daysAgo: 17,
            category: "Anime",
          },
        ],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 11,
        torrents: [
          {
            title:
              "[ANi] 【推しの子】Second Season - 02 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 503_316_480,
            daysAgo: 11,
            category: "動畫",
          },
          {
            title: "[喵萌奶茶屋&LoliHouse] 【推子】Second Season - 02 [1080p][WebRip]",
            subgroup: "喵萌奶茶屋&LoliHouse",
            resolution: "1080p",
            size: 545_259_520,
            daysAgo: 10,
            category: "动画",
          },
        ],
      },
      {
        number: 3,
        coverUrl: null,
        daysAgo: 4,
        torrents: [
          {
            title:
              "[ANi] 【推しの子】Second Season - 03 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 497_025_024,
            daysAgo: 4,
            category: "動畫",
          },
          {
            title: "[SubsPlease] Oshi no Ko S2 - 03 (720p) [ABCDEF01].mkv",
            subgroup: "SubsPlease",
            resolution: "720p",
            size: 272_629_760,
            daysAgo: 3,
            category: "Anime",
          },
        ],
      },
    ],
  },
  {
    owner: "demo",
    title: "Doupo Cangqiong",
    season: 1,
    year: 2018,
    origin: "CN",
    airDay: 2,
    type: "ONA",
    coverUrl: poster("Doupo", "b45309"),
    watchStatus: "WATCHING",
    createdDaysAgo: 90,
    synonyms: [
      { lang: "zh-Hans", title: "斗破苍穹" },
      { lang: "zh-Hant", title: "斗破蒼穹" },
      { lang: "en", title: "Battle Through the Heavens" },
    ],
    episodes: [
      {
        number: 1,
        contents: [
          {
            lang: "zh-CN",
            title: null,
            content: "萧炎在药老的帮助下重拾修炼信心，三年之约的战斗即将打响。",
          },
        ],
        coverUrl: null,
        daysAgo: 14,
        torrents: [],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 7,
        torrents: [
          {
            title: "[ANi] 斗破苍穹 - 02 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 629_145_600,
            daysAgo: 7,
            category: "動畫",
          },
        ],
      },
      {
        number: 3,
        coverUrl: null,
        daysAgo: 0,
        torrents: [
          {
            title: "[ANi] 斗破苍穹 - 03 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 637_534_208,
            daysAgo: 0,
            category: "動畫",
          },
          {
            title: "[喵萌奶茶屋] 斗破苍穹 - 03 [1080p]",
            subgroup: "喵萌奶茶屋",
            resolution: "720p",
            size: 335_544_320,
            daysAgo: 0,
            category: "动画",
          },
        ],
      },
    ],
  },
  {
    owner: "demo",
    title: "Solo Leveling",
    season: 1,
    year: 2024,
    origin: "KR",
    airDay: 4,
    type: "TV",
    coverUrl: poster("Solo Leveling", "4f46e5"),
    watchStatus: "WATCHING",
    createdDaysAgo: 45,
    synonyms: [
      { lang: "ko", title: "나 혼자만 레벨업" },
      { lang: "zh-Hans", title: "我独自升级" },
      { lang: "en", title: "Only I Level Up" },
    ],
    episodes: [
      {
        number: 1,
        contents: [
          {
            lang: "zh-CN",
            title: null,
            content: "被称为韩国最弱猎人的程肖宇，在双重地下城中获得了神秘的系统。",
          },
        ],
        coverUrl: still("EP 01"),
        daysAgo: 25,
        torrents: [],
      },
      { number: 2, coverUrl: null, daysAgo: 18, torrents: [] },
      {
        number: 3,
        coverUrl: null,
        daysAgo: 11,
        torrents: [
          {
            title: "[SubsPlease] Solo Leveling - 03 (1080p) [BCDEF012].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 503_316_480,
            daysAgo: 11,
            category: "Anime",
          },
          {
            title: "[ANi] 我独自升级 - 03 [1080P][Baha][WEB-DL][AAC AVC][CHT]",
            subgroup: "ANi",
            resolution: "1080p",
            size: 524_288_000,
            daysAgo: 10,
            category: "動畫",
          },
        ],
      },
      {
        number: 4,
        coverUrl: null,
        daysAgo: 4,
        torrents: [
          {
            title: "[SubsPlease] Solo Leveling - 04 (1080p) [CDEF0123].mkv",
            subgroup: "SubsPlease",
            resolution: "1080p",
            size: 498_073_600,
            daysAgo: 4,
            category: "Anime",
          },
          {
            title: "[LoliHouse] Solo Leveling - 04 [WebRip 1080p HEVC-10bit AAC][简繁内嵌]",
            subgroup: "LoliHouse",
            resolution: "1080p",
            size: 486_539_264,
            daysAgo: 3,
            category: "动画",
            description: "TV 动画《我独自升级》第 4 集，内嵌简繁字幕。",
          },
        ],
      },
    ],
  },
  {
    owner: "demo",
    title: "Arcane",
    season: 1,
    year: 2021,
    origin: "WEST",
    airDay: 6,
    type: "TV",
    coverUrl: poster("Arcane", "7c3aed"),
    watchStatus: "PAUSED",
    createdDaysAgo: 80,
    synonyms: [
      { lang: "zh-Hant", title: "英雄聯盟：雙城之戰" },
      { lang: "en", title: "Arcane: League of Legends" },
    ],
    episodes: [
      {
        number: 1,
        coverUrl: null,
        daysAgo: 50,
        torrents: [
          {
            title:
              "Arcane.S01E01.Welcome.to.the.Playground.1080p.NF.WEB-DL.DDP5.1.H.264-FLUX",
            subgroup: "FLUX",
            resolution: "1080p",
            size: 2_348_810_240,
            daysAgo: 50,
            category: "Anime",
          },
        ],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 43,
        torrents: [
          {
            title:
              "Arcane.S01E02.Some.Mysteries.Are.Better.Left.Unsolved.1080p.NF.WEB-DL.DDP5.1.H.264-FLUX",
            subgroup: "FLUX",
            resolution: "1080p",
            size: 2_411_724_800,
            daysAgo: 43,
            category: "Anime",
          },
        ],
      },
      {
        number: 3,
        coverUrl: null,
        daysAgo: 36,
        torrents: [
          {
            title:
              "Arcane.S01E03.The.Base.Violence.Necessary.for.Change.1080p.NF.WEB-DL.DDP5.1.H.264-FLUX",
            subgroup: "FLUX",
            resolution: "1080p",
            size: 2_390_753_280,
            daysAgo: 36,
            category: "Anime",
          },
        ],
      },
      {
        number: 4,
        coverUrl: null,
        daysAgo: 29,
        torrents: [
          {
            title:
              "Arcane.S01E04.Happy.Progress.Day.1080p.NF.WEB-DL.DDP5.1.H.264-FLUX",
            subgroup: "FLUX",
            resolution: "1080p",
            size: 2_369_781_760,
            daysAgo: 29,
            category: "Anime",
          },
        ],
      },
    ],
  },
  {
    owner: "alice",
    title: "Suzume no Tojimari",
    season: 1,
    year: 2022,
    origin: "JP",
    airDay: null,
    type: "MOVIE",
    coverUrl: poster("Suzume", "0891b2"),
    watchStatus: "COMPLETED",
    createdDaysAgo: 300,
    synonyms: [
      { lang: "ja", title: "すずめの戸締まり" },
      { lang: "en", title: "Suzume" },
      { lang: "zh-Hans", title: "铃芽之旅" },
    ],
    episodes: [
      {
        number: 1,
        contents: [
          {
            lang: "zh-CN",
            title: "旅程的开始",
            content: "为了关闭引发灾厄的“门”，铃芽踏上了纵贯日本列岛的旅程。",
          },
          {
            lang: "en",
            title: "The Beginning of a Journey",
            content:
              "To close the doors that unleash calamity, Suzume sets out on a journey across Japan.",
          },
        ],
        coverUrl: still("MOVIE"),
        daysAgo: 295,
        torrents: [],
      },
    ],
    unparsedTorrents: [
      {
        title: "[ANi] 铃芽之旅 [剧场版][1080P][Baha][WEB-DL][AAC AVC][CHT]",
        subgroup: "ANi",
        resolution: "1080p",
        size: 2_415_919_104,
        daysAgo: 290,
        category: "动画",
        animeTitle: "铃芽之旅",
      },
      {
        title: "[VCB-Studio] Suzume no Tojimari [Ma10p_1080p]",
        subgroup: "VCB-Studio",
        resolution: "1080p",
        size: 5_153_960_755,
        daysAgo: 200,
        category: "合集",
        description: "10bit 1080p 收藏版，附带特典映像。",
        animeTitle: "Suzume no Tojimari",
      },
    ],
  },
  {
    owner: "demo",
    title: "Hellsing Ultimate",
    season: 1,
    year: 2006,
    origin: "JP",
    airDay: null,
    type: "OVA",
    coverUrl: null,
    watchStatus: "COMPLETED",
    createdDaysAgo: 400,
    synonyms: [
      { lang: "ja", title: "ヘルシング" },
      { lang: "en", title: "Hellsing OVA" },
    ],
    episodes: [
      {
        number: 1,
        coverUrl: null,
        daysAgo: 390,
        torrents: [
          {
            title: "[a4e]Hellsing_Ultimate_OVA_01_[720p]",
            subgroup: "a4e",
            resolution: "720p",
            size: 367_001_600,
            daysAgo: 389,
            category: "Anime",
          },
        ],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 385,
        torrents: [
          {
            title: "[a4e]Hellsing_Ultimate_OVA_02_[720p]",
            subgroup: "a4e",
            resolution: "720p",
            size: 371_195_904,
            daysAgo: 384,
            category: "Anime",
          },
        ],
      },
    ],
  },
  {
    owner: "alice",
    title: "Quan Zhi Gao Shou",
    season: 1,
    year: 2017,
    origin: "CN",
    airDay: null,
    type: "ONA",
    coverUrl: null,
    watchStatus: "PLANNED",
    createdDaysAgo: 10,
    synonyms: [
      { lang: "zh-Hans", title: "全职高手" },
      { lang: "en", title: "The King's Avatar" },
    ],
    episodes: [],
  },
  {
    owner: "demo",
    title: "Tokyo Revengers",
    season: 1,
    year: 2021,
    origin: "JP",
    airDay: null,
    type: "TV",
    coverUrl: null,
    watchStatus: "DROPPED",
    createdDaysAgo: 180,
    synonyms: [
      { lang: "ja", title: "東京リベンジャーズ" },
      { lang: "zh-Hans", title: "东京卍复仇者" },
    ],
    episodes: [
      {
        number: 1,
        coverUrl: null,
        daysAgo: 170,
        torrents: [
          {
            title: "[SubsPlease] Tokyo Revengers - 01 (720p) [DEF01234].mkv",
            subgroup: "SubsPlease",
            resolution: "720p",
            size: 251_658_240,
            daysAgo: 170,
            category: "Anime",
          },
        ],
      },
      {
        number: 2,
        coverUrl: null,
        daysAgo: 168,
        torrents: [
          {
            title: "[SubsPlease] Tokyo Revengers - 02 (720p) [EF012345].mkv",
            subgroup: "SubsPlease",
            resolution: "720p",
            size: 253_755_392,
            daysAgo: 168,
            category: "Anime",
          },
        ],
      },
    ],
  },
];

/** Torrents that match no tracked anime — they stay in the admin list
 * until someone links or creates an entry for them. */
const UNLINKED_TORRENTS: SeedTorrent[] = [
  {
    title: "[SubsPlease] Shangri-La Frontier - 05 (1080p) [F0123456].mkv",
    subgroup: "SubsPlease",
    resolution: "1080p",
    size: 513_802_240,
    daysAgo: 1,
    category: "Anime",
    animeTitle: "Shangri-La Frontier",
    season: 1,
    episode: 5,
  },
];

/* --------------------------------------------------------------- seeding */

/** Insert the user if missing. Re-runs leave existing rows alone. */
async function ensureUser(opts: {
  username: string;
  email: string;
  password: string;
  role: string;
}): Promise<User> {
  const existing = (
    await db.select().from(users).where(eq(users.username, opts.username)).limit(1)
  )[0];
  if (existing) {
    if (opts.role === "admin" && existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
      console.log(`User "${opts.username}" already exists — promoted to admin`);
      return { ...existing, role: "admin" };
    }
    console.log(`User "${opts.username}" already exists — skipped`);
    return existing;
  }
  const created = (
    await db
      .insert(users)
      .values({
        username: opts.username,
        name: opts.username,
        email: opts.email,
        passwordHash: await hashPassword(opts.password),
        role: opts.role,
      })
      .returning()
  )[0];
  console.log(`Created user "${opts.username}" (password: ${opts.password})`);
  return created;
}

/** Insert torrents by their dedup key; skips rows that already exist. */
async function insertTorrents(
  rows: (typeof torrentItems.$inferInsert)[]
): Promise<number> {
  let created = 0;
  for (const row of rows) {
    const existing = (
      await db
        .select({ id: torrentItems.id })
        .from(torrentItems)
        .where(eq(torrentItems.infoHash, row.infoHash))
        .limit(1)
    )[0];
    if (existing) continue;
    await db.insert(torrentItems).values(row);
    created += 1;
  }
  return created;
}

/**
 * Seeds demo accounts and a batch of anime covering every weekday
 * section, origin, work type and watch status (plus covers, episodes
 * and releases). Safe to re-run: existing rows are left alone.
 */
async function main(): Promise<void> {
  console.log("Seeding demo data...");

  const admin = await ensureUser({
    username: process.env.SEED_USERNAME ?? "demo",
    email: process.env.SEED_EMAIL ?? "demo@torrenthub.local",
    password: process.env.SEED_PASSWORD ?? "demo12345",
    role: "admin",
  });
  const alice = await ensureUser({
    username: "alice",
    email: "alice@torrenthub.local",
    password: "alice12345",
    role: "user",
  });
  await ensureUser({
    username: "bob",
    email: "bob@torrenthub.local",
    password: "bob12345",
    role: "user",
  });

  let createdAnime = 0;
  let createdEpisodes = 0;
  let createdTorrents = 0;
  let skippedAnime = 0;

  for (const seed of DEMO_ANIME) {
    // Dedup on the primary name in anime_infos (the anime row has no title)
    const existing = (
      await db
        .select({ id: anime.id })
        .from(anime)
        .innerJoin(
          animeInfos,
          and(eq(animeInfos.animeId, anime.id), eq(animeInfos.kind, "primary"))
        )
        .where(and(eq(animeInfos.title, seed.title), eq(anime.season, seed.season)))
        .limit(1)
    )[0];
    if (existing) {
      console.log(`Anime "${seed.title}" already exists — skipped`);
      skippedAnime += 1;
      continue;
    }

    const owner = seed.owner === "alice" ? alice : admin;
    const row = (
      await db
        .insert(anime)
        .values({
          userId: owner.id,
          season: seed.season,
          year: seed.year,
          origin: seed.origin,
          airDay: seed.airDay,
          type: seed.type,
          coverUrl: seed.coverUrl,
          watchStatus: seed.watchStatus,
          updatedBy: owner.id,
          createdAt: daysAgo(seed.createdDaysAgo),
        })
        .returning()
    )[0];
    createdAnime += 1;

    // Structured names: primary row + synonyms, mirroring saveAnimeAction
    await db.insert(animeInfos).values([
      { animeId: row.id, kind: "primary", lang: null, title: seed.title },
      ...seed.synonyms.map((s) => ({
        animeId: row.id,
        kind: "synonym",
        lang: s.lang,
        title: s.title,
      })),
    ]);

    const torrentRows: (typeof torrentItems.$inferInsert)[] = [];

    if (seed.episodes.length > 0) {
      const episodeRows = await db
        .insert(animeEpisodes)
        .values(
          seed.episodes.map((ep) => ({
            animeId: row.id,
            number: ep.number,
            coverUrl: ep.coverUrl,
            createdAt: daysAgo(ep.daysAgo),
            updatedAt: daysAgo(ep.daysAgo),
          }))
        )
        .returning();
      createdEpisodes += episodeRows.length;

      const idByNumber = new Map(episodeRows.map((r) => [r.number, r.id]));

      // Multilingual info rows (episode_infos), keyed by episode number
      const contentRows = seed.episodes.flatMap((ep) =>
        (ep.contents ?? []).map((c) => ({
          episodeId: idByNumber.get(ep.number)!,
          lang: c.lang,
          title: c.title,
          content: c.content,
          createdAt: daysAgo(ep.daysAgo),
          updatedAt: daysAgo(ep.daysAgo),
        }))
      );
      if (contentRows.length > 0) {
        await db.insert(episodeInfos).values(contentRows);
      }

      for (const ep of seed.episodes) {
        for (const t of ep.torrents) {
          torrentRows.push({
            title: t.title,
            description: t.description ?? null,
            magnet: magnetOf(t.title),
            torrentUrl: torrentUrlOf(t.title),
            infoHash: sha1(t.title),
            size: t.size,
            publishTime: daysAgo(t.daysAgo),
            category: t.category ?? null,
            animeTitle: t.animeTitle ?? seed.title,
            season: t.season ?? seed.season,
            episode: ep.number,
            resolution: t.resolution,
            subgroup: t.subgroup,
            animeId: row.id,
            episodeId: idByNumber.get(ep.number)!,
            createdAt: daysAgo(t.daysAgo),
          });
        }
      }
    }

    // Releases without a parseable episode number stay on the anime row
    for (const t of seed.unparsedTorrents ?? []) {
      torrentRows.push({
        title: t.title,
        description: t.description ?? null,
        magnet: magnetOf(t.title),
        torrentUrl: torrentUrlOf(t.title),
        infoHash: sha1(t.title),
        size: t.size,
        publishTime: daysAgo(t.daysAgo),
        category: t.category ?? null,
        animeTitle: t.animeTitle ?? seed.title,
        season: t.season ?? null,
        episode: t.episode ?? null,
        resolution: t.resolution,
        subgroup: t.subgroup,
        animeId: row.id,
        episodeId: null,
        createdAt: daysAgo(t.daysAgo),
      });
    }

    const added = await insertTorrents(torrentRows);
    createdTorrents += added;
    console.log(
      `Created anime "${seed.title}" (${seed.episodes.length} episodes, ${added} torrents)`
    );
  }

  createdTorrents += await insertTorrents(
    UNLINKED_TORRENTS.map((t) => ({
      title: t.title,
      description: t.description ?? null,
      magnet: magnetOf(t.title),
      torrentUrl: torrentUrlOf(t.title),
      infoHash: sha1(t.title),
      size: t.size,
      publishTime: daysAgo(t.daysAgo),
      category: t.category ?? null,
      animeTitle: t.animeTitle ?? null,
      season: t.season ?? null,
      episode: t.episode ?? null,
      resolution: t.resolution,
      subgroup: t.subgroup,
      animeId: null,
      episodeId: null,
      createdAt: daysAgo(t.daysAgo),
    }))
  );

  console.log(
    `Seed complete: ${createdAnime} anime (${skippedAnime} skipped), ` +
      `${createdEpisodes} episodes, ${createdTorrents} torrents created.`
  );
  console.log("Login with demo / demo12345 (admin) or alice / alice12345.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
