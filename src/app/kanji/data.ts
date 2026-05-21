// 漢字ドリル全単元統合学習データ（小学4年 上・新学社）
// 元データ: af2c61a5-Kanji_Drill_Complete_Master_Data.md

export type ReadItem = {
  // 読み問題: kanji（出題する漢字を含む語）と reading（ひらがな答え）
  kanji: string
  reading: string
  hint?: string // 文脈
}

export type WriteItem = {
  // 書き問題: reading（ひらがな・文脈）から kanji を書く
  kanji: string // 正解の漢字
  reading: string // 読み（ヒント・ひらがな）
  hint?: string // 文章中の文脈
}

export type Lesson = {
  no: number
  title: string
  unit: string
  newKanji: { kanji: string; readings: string; examples: string[] }[]
  read: ReadItem[]
  write: WriteItem[]
}

export const LESSONS: Lesson[] = [
  {
    no: 5,
    title: '新しい漢字・ドリル',
    unit: '白いぼうし',
    newKanji: [
      { kanji: '建', readings: 'ケン・たてる', examples: ['鉄道を建設する', '大きな建物'] },
      { kanji: '席', readings: 'セキ', examples: ['席にすわる', 'バスの運転席'] },
      { kanji: '飛', readings: 'ヒ・とぶ', examples: ['大空を飛行する', '鳥が空を飛ぶ'] },
      { kanji: '達', readings: 'タツ', examples: ['字が達筆する', '速達がとどく'] },
      { kanji: '信', readings: 'シン・しんじる', examples: ['自分を信じる', '信号が青になる'] },
    ],
    read: [
      { kanji: '着く', reading: 'つく', hint: '学校に__' },
      { kanji: '動かす', reading: 'うごかす', hint: '体を__' },
      { kanji: '整える', reading: 'ととのえる', hint: '列を__' },
      { kanji: '助かる', reading: 'たすかる', hint: '人にも__' },
      { kanji: '温める', reading: 'あたためる', hint: 'スープを__' },
      { kanji: '言葉', reading: 'ことば', hint: '短い__で表す' },
      { kanji: '園外', reading: 'えんがい', hint: '__で遊ぶ' },
      { kanji: '炭火', reading: 'すみび', hint: '__でやく' },
      { kanji: '客席', reading: 'きゃくせき', hint: '__にすわる' },
      { kanji: '鉄橋', reading: 'てっきょう', hint: '__をわたる' },
    ],
    write: [
      { kanji: '内', reading: 'ない', hint: '町の__' },
      { kanji: '広', reading: 'ひろ', hint: '__い庭' },
      { kanji: '緑', reading: 'みどり', hint: '__のカーテン' },
      { kanji: '茶', reading: 'ちゃ', hint: 'お__を飲む' },
      { kanji: '坂', reading: 'さか', hint: '__を歩く' },
      { kanji: '車掌', reading: 'しゃしょう', hint: '__さん' },
      { kanji: '大', reading: 'おお', hint: '__きな犬' },
      { kanji: '古', reading: 'ふる', hint: '__いお寺' },
      { kanji: '放', reading: 'はな', hint: '鳥を__す' },
      { kanji: '勝', reading: 'か', hint: '赤組が__つ' },
    ],
  },
  {
    no: 6,
    title: '新しい漢字',
    unit: '白いぼうし',
    newKanji: [
      { kanji: '例', readings: 'レイ・たとえる', examples: ['例をあげて話す', '例えばの話'] },
      { kanji: '標', readings: 'ヒョウ', examples: ['目標を立てる', 'こん虫の標本'] },
      { kanji: '菜', readings: 'サイ・な', examples: ['野菜のサラダ', '菜の花をつむ'] },
    ],
    read: [
      { kanji: '友達', reading: 'ともだち', hint: '__と話す' },
      { kanji: '速達', reading: 'そくたつ', hint: '__で手紙がとどく' },
    ],
    write: [
      { kanji: '達', reading: 'たつ', hint: '速__で手紙がとどく' },
    ],
  },
  {
    no: 7,
    title: 'ドリル（まとめ）',
    unit: '白いぼうし',
    newKanji: [],
    read: [
      { kanji: '転席', reading: 'てんせき', hint: '運__にすわる' },
      { kanji: '建物', reading: 'たてもの', hint: '四角い__' },
      { kanji: '飛行船', reading: 'ひこうせん', hint: '__が空にうかぶ' },
      { kanji: '建設', reading: 'けんせつ', hint: 'ビルを__する' },
    ],
    write: [
      { kanji: '予想', reading: 'よそう', hint: '答えを__する' },
      { kanji: '整理', reading: 'せいり', hint: '言葉を__する' },
      { kanji: '出来事', reading: 'できごと', hint: '__が起こる' },
      { kanji: '信号', reading: 'しんごう', hint: '__が赤になる' },
      { kanji: '始まる', reading: 'はじまる', hint: '夏が__' },
      { kanji: '速達', reading: 'そくたつ', hint: '__で送る' },
      { kanji: '裏通り', reading: 'うらどおり', hint: '細い__' },
      { kanji: '飛ぶ', reading: 'とぶ', hint: 'ちょうが__' },
      { kanji: '菜', reading: 'な', hint: '__の花がさく' },
      { kanji: '標', reading: 'ひょう', hint: '目__を決める' },
      { kanji: '例', reading: 'れい', hint: 'いくつか__をあげる' },
      { kanji: '野菜', reading: 'やさい', hint: '__を食べる' },
    ],
  },
  {
    no: 9,
    title: '新しい漢字',
    unit: '図書館の達人になろう',
    newKanji: [
      { kanji: '司', readings: 'シ', examples: ['式の司会をする', '司書の仕事'] },
      { kanji: '械', readings: 'カイ', examples: ['器械たいそうをする', '工場の機械'] },
      { kanji: '機', readings: 'キ', examples: ['飛行機に乗る', '機会をしんちょうに待つ'] },
      { kanji: '類', readings: 'ルイ', examples: ['植物を分類する', '類いまれな音色'] },
      { kanji: '法', readings: 'ホウ', examples: ['練習の方法', '法律を守る'] },
    ],
    read: [
      { kanji: '司会', reading: 'しかい', hint: '式の__をする' },
      { kanji: '機械', reading: 'きかい', hint: '工場の__' },
      { kanji: '飛行機', reading: 'ひこうき', hint: '__に乗る' },
      { kanji: '分類', reading: 'ぶんるい', hint: '植物を__する' },
      { kanji: '方法', reading: 'ほうほう', hint: '練習の__' },
    ],
    write: [
      { kanji: '司書', reading: 'ししょ', hint: '__の仕事' },
      { kanji: '機会', reading: 'きかい', hint: '__をしんちょうに待つ' },
      { kanji: '法律', reading: 'ほうりつ', hint: '__を守る' },
    ],
  },
  {
    no: 11,
    title: '新しい漢字・ドリル',
    unit: '図書館の達人になろう',
    newKanji: [
      { kanji: '録', readings: 'ロク', examples: ['話し合いの記録', '歌声を録音する'] },
      { kanji: '順', readings: 'ジュン', examples: ['順にならぶ', '五十音順の言葉'] },
      { kanji: '典', readings: 'テン', examples: ['式典に出席する', '百科事典で調べる'] },
    ],
    read: [
      { kanji: '記録', reading: 'きろく', hint: '話し合いの__' },
      { kanji: '録音', reading: 'ろくおん', hint: '歌声を__する' },
      { kanji: '順', reading: 'じゅん', hint: '__にならぶ' },
      { kanji: '式典', reading: 'しきてん', hint: '__に出席する' },
      { kanji: '百科事典', reading: 'ひゃっかじてん', hint: '__で調べる' },
    ],
    write: [
      { kanji: '録画', reading: 'ろくが', hint: '__した番組を見る' },
      { kanji: '順', reading: 'じゅん', hint: '五十音__の言葉' },
    ],
  },
  {
    no: 13,
    title: '新しい漢字・ドリル',
    unit: '走れ',
    newKanji: [
      { kanji: '不', readings: 'フ・ブ', examples: ['不思議なできごと', '体調が不良だ'] },
      { kanji: '付', readings: 'フ・つける', examples: ['かたづけを言いつ付ける', '日付をたしかめる'] },
      { kanji: '清', readings: 'セイ・きよまる', examples: ['清らかな水', '教室を清掃する'] },
      { kanji: '管', readings: 'カン', examples: ['水管の工事', '体調を管理する'] },
    ],
    read: [
      { kanji: '波', reading: 'なみ', hint: '__が打ちよせる' },
      { kanji: '張る', reading: 'はる', hint: 'テントを__' },
      { kanji: '湯気', reading: 'ゆげ', hint: '__が立つ' },
      { kanji: '注ぐ', reading: 'そそぐ', hint: 'お茶を__' },
      { kanji: '消火器', reading: 'しょうかき', hint: '__をおく' },
      { kanji: '消す', reading: 'けす', hint: '火を__' },
      { kanji: '炭', reading: 'すみ', hint: '__をおこす' },
      { kanji: '平気', reading: 'へいき', hint: '__な顔' },
      { kanji: '平和', reading: 'へいわ', hint: '__を願う' },
    ],
    write: [
      { kanji: '信', reading: 'しん', hint: '友だちを__じる' },
      { kanji: '信号', reading: 'しんごう', hint: '__をよく見る' },
      { kanji: '不思議', reading: 'ふしぎ', hint: '__なできごと' },
      { kanji: '不良', reading: 'ふりょう', hint: '体調が__だ' },
      { kanji: '付', reading: 'つ', hint: '言い__ける' },
      { kanji: '日付', reading: 'ひづけ', hint: '__をたしかめる' },
      { kanji: '清', reading: 'きよ', hint: '__らかな水' },
      { kanji: '清掃', reading: 'せいそう', hint: '教室を__する' },
      { kanji: '水管', reading: 'すいかん', hint: '__の工事' },
      { kanji: '管理', reading: 'かんり', hint: '体調を__する' },
    ],
  },
  {
    no: 15,
    title: '新しい漢字・ドリル',
    unit: '初雪のふる日',
    newKanji: [
      { kanji: '祝', readings: 'シュク・いわう', examples: ['誕生日を祝う', '祝日'] },
      { kanji: '覚', readings: 'カク・おぼえる', examples: ['漢字を覚える', '目が覚める'] },
      { kanji: '関', readings: 'カン・せき', examples: ['関所を通る', '関心を持つ'] },
      { kanji: '票', readings: 'ヒョウ', examples: ['選挙の票', '投票に行く'] },
    ],
    read: [
      { kanji: '飼う', reading: 'かう', hint: '犬を__' },
      { kanji: '植物', reading: 'しょくぶつ', hint: '__を育てる' },
      { kanji: '根', reading: 'ね', hint: '__がのびる' },
      { kanji: '他', reading: 'ほか', hint: '__の人にゆずる' },
      { kanji: '交代', reading: 'こうたい', hint: '席を__する' },
      { kanji: '守り', reading: 'まもり', hint: '__神' },
      { kanji: '命', reading: 'いのち', hint: '__を大切にする' },
      { kanji: '寒風', reading: 'かんぷう', hint: '__がふく' },
      { kanji: '氷', reading: 'こおり', hint: '__がはる' },
      { kanji: '美しい', reading: 'うつくしい', hint: '__景色' },
    ],
    write: [
      { kanji: '祝う', reading: 'いわう', hint: '誕生日を__' },
      { kanji: '祝日', reading: 'しゅくじつ', hint: '__の休み' },
      { kanji: '覚える', reading: 'おぼえる', hint: '漢字を__' },
      { kanji: '覚める', reading: 'さめる', hint: '目が__' },
      { kanji: '関所', reading: 'せきしょ', hint: '箱根の__' },
      { kanji: '関心', reading: 'かんしん', hint: '政治に__を持つ' },
      { kanji: '票', reading: 'ひょう', hint: '選挙の__' },
      { kanji: '投票', reading: 'とうひょう', hint: '目的地に__する' },
    ],
  },
  {
    no: 17,
    title: '新しい漢字',
    unit: '一つの花',
    newKanji: [
      { kanji: '戦', readings: 'セン・たたかう', examples: ['戦争をなくす', '試合で戦う'] },
      { kanji: '争', readings: 'ソウ・あらそう', examples: ['言い争い', '競争する'] },
      { kanji: '仲', readings: 'チュウ・なか', examples: ['仲が良い', '仲間とはげます'] },
      { kanji: '栄', readings: 'エイ・さかえる', examples: ['町が栄える', '栄養をとる'] },
      { kanji: '労', readings: 'ロウ', examples: ['労働の時間', '苦労をかける'] },
    ],
    read: [
      { kanji: '戦争', reading: 'せんそう', hint: '__をなくす' },
      { kanji: '戦う', reading: 'たたかう', hint: '試合で__' },
      { kanji: '言い争い', reading: 'いいあらそい', hint: '__をする' },
      { kanji: '競争', reading: 'きょうそう', hint: '友達と__する' },
      { kanji: '仲', reading: 'なか', hint: '__が良い' },
      { kanji: '仲間', reading: 'なかま', hint: '__を信じる' },
      { kanji: '栄える', reading: 'さかえる', hint: '町が__' },
      { kanji: '栄養', reading: 'えいよう', hint: '__をとる' },
      { kanji: '労働', reading: 'ろうどう', hint: '__の時間' },
      { kanji: '苦労', reading: 'くろう', hint: '__をかける' },
    ],
    write: [
      { kanji: '戦争', reading: 'せんそう', hint: '__をなくす' },
      { kanji: '戦う', reading: 'たたかう', hint: '試合で__' },
      { kanji: '言い争い', reading: 'いいあらそい', hint: '__をする' },
      { kanji: '競争', reading: 'きょうそう', hint: '友達と__する' },
      { kanji: '仲', reading: 'なか', hint: '__が良い' },
      { kanji: '仲間', reading: 'なかま', hint: '__を信じる' },
      { kanji: '栄える', reading: 'さかえる', hint: '町が__' },
      { kanji: '栄養', reading: 'えいよう', hint: '__をとる' },
      { kanji: '労働', reading: 'ろうどう', hint: '__の時間' },
      { kanji: '苦労', reading: 'くろう', hint: '__をかける' },
    ],
  },
  {
    no: 23,
    title: '新しい漢字（都道府県）',
    unit: 'カンジ博士の都道府県の旅1',
    newKanji: [
      { kanji: '阜', readings: 'フ', examples: ['岐阜県'] },
      { kanji: '岐', readings: 'キ', examples: ['岐阜県'] },
      { kanji: '量', readings: 'リョウ', examples: ['量をはかる'] },
      { kanji: '梨', readings: 'なし', examples: ['山梨県'] },
      { kanji: '井', readings: 'い', examples: ['福井県'] },
      { kanji: '岡', readings: 'おか', examples: ['静岡県'] },
      { kanji: '郡', readings: 'グン', examples: ['群馬県'] },
      { kanji: '節', readings: 'セツ', examples: ['季節の変化'] },
      { kanji: '季', readings: 'キ', examples: ['四季の移り変わり'] },
      { kanji: '以', readings: 'イ', examples: ['以上'] },
    ],
    read: [
      { kanji: '茨城', reading: 'いばらき', hint: '__県' },
      { kanji: '夕張', reading: 'ゆうばり', hint: '__市' },
      { kanji: '宮城', reading: 'みやぎ', hint: '__県' },
      { kanji: '群馬', reading: 'ぐんま', hint: '__県' },
      { kanji: '新潟', reading: 'にいがた', hint: '__県' },
      { kanji: '富山', reading: 'とやま', hint: '__県' },
      { kanji: '神奈川', reading: 'かながわ', hint: '__県' },
      { kanji: '岐阜', reading: 'ぎふ', hint: '__県' },
      { kanji: '石川', reading: 'いしかわ', hint: '__県' },
      { kanji: '用いる', reading: 'もちいる', hint: '記号を__' },
    ],
    write: [
      { kanji: '茨城', reading: 'いばらき', hint: '__県' },
      { kanji: '夕張', reading: 'ゆうばり', hint: '__市' },
      { kanji: '宮城', reading: 'みやぎ', hint: '__県' },
      { kanji: '群馬', reading: 'ぐんま', hint: '__県' },
      { kanji: '新潟', reading: 'にいがた', hint: '__県' },
      { kanji: '富山', reading: 'とやま', hint: '__県' },
      { kanji: '神奈川', reading: 'かながわ', hint: '__県' },
      { kanji: '岐阜', reading: 'ぎふ', hint: '__県' },
      { kanji: '石川', reading: 'いしかわ', hint: '__県' },
      { kanji: '目的', reading: 'もくてき', hint: '話し合いの__' },
      { kanji: '用いる', reading: 'もちいる', hint: '記号を__' },
      { kanji: '必要', reading: 'ひつよう', hint: '__なこと' },
      { kanji: '準備', reading: 'じゅんび', hint: '発表の__' },
      { kanji: '聞く', reading: 'きく', hint: '静かに__' },
    ],
  },
  {
    no: 25,
    title: 'たしかめ（三年生で習った漢字①）',
    unit: '三年生で習った漢字',
    newKanji: [],
    read: [
      { kanji: '必要', reading: 'ひつよう', hint: '__な事' },
      { kanji: '用いる', reading: 'もちいる', hint: '記号を__' },
      { kanji: '目的', reading: 'もくてき', hint: '話し合いの__' },
      { kanji: '準備', reading: 'じゅんび', hint: '発表の__' },
    ],
    write: [
      { kanji: '日光', reading: 'にっこう', hint: '__へ旅行する' },
      { kanji: '旅行', reading: 'りょこう', hint: '日光へ__する' },
      { kanji: '駅', reading: 'えき', hint: '__の前で集合する' },
      { kanji: '集合', reading: 'しゅうごう', hint: '駅の前で__する' },
      { kanji: '特急', reading: 'とっきゅう', hint: '__列車' },
      { kanji: '発車', reading: 'はっしゃ', hint: '列車が__する' },
      { kanji: '景色', reading: 'けしき', hint: '窓から__をながめる' },
      { kanji: '山頂', reading: 'さんちょう', hint: '__からのながめ' },
      { kanji: '最高', reading: 'さいこう', hint: 'ながめは__だ' },
    ],
  },
  {
    no: 29,
    title: '新しい漢字',
    unit: 'お礼の気持ちを伝えよう/アップとルーズで伝える',
    newKanji: [
      { kanji: '選', readings: 'セン・えらぶ', examples: ['選手を選ぶ'] },
      { kanji: '試', readings: 'シ・こころみる', examples: ['実験を試みる'] },
      { kanji: '説', readings: 'セツ', examples: ['理由を説明する'] },
      { kanji: '案', readings: 'アン', examples: ['案内の手紙'] },
      { kanji: '伝', readings: 'デン・つたえる', examples: ['気持ちを伝える'] },
      { kanji: '材', readings: 'ザイ', examples: ['題材を選ぶ'] },
      { kanji: '利', readings: 'リ', examples: ['便利な道具'] },
      { kanji: '旗', readings: 'はた', examples: ['国旗を掲げる'] },
      { kanji: '観', readings: 'カン', examples: ['観光地'] },
    ],
    read: [
      { kanji: '選ぶ', reading: 'えらぶ', hint: '選手を__' },
      { kanji: '試みる', reading: 'こころみる', hint: '実験を__' },
      { kanji: '説明', reading: 'せつめい', hint: '理由を__する' },
      { kanji: '案内', reading: 'あんない', hint: '__の手紙' },
      { kanji: '伝える', reading: 'つたえる', hint: '気持ちを__' },
      { kanji: '題材', reading: 'だいざい', hint: '__を選ぶ' },
      { kanji: '便利', reading: 'べんり', hint: '__な道具' },
      { kanji: '国旗', reading: 'こっき', hint: '__を掲げる' },
      { kanji: '観光', reading: 'かんこう', hint: '__地' },
    ],
    write: [
      { kanji: '選ぶ', reading: 'えらぶ', hint: '選手を__' },
      { kanji: '試みる', reading: 'こころみる', hint: '実験を__' },
      { kanji: '説明', reading: 'せつめい', hint: '理由を__する' },
      { kanji: '案内', reading: 'あんない', hint: '__の手紙' },
      { kanji: '伝える', reading: 'つたえる', hint: '気持ちを__' },
      { kanji: '関係', reading: 'かんけい', hint: '段落の__' },
      { kanji: '題材', reading: 'だいざい', hint: '中心となる__' },
      { kanji: '便利', reading: 'べんり', hint: '__な道具' },
      { kanji: '国旗', reading: 'こっき', hint: '__を掲げる' },
      { kanji: '観光', reading: 'かんこう', hint: '__地' },
    ],
  },
  {
    no: 31,
    title: 'たしかめ（三年生で習った漢字②）',
    unit: '三年生で習った漢字',
    newKanji: [],
    read: [
      { kanji: '理由', reading: 'りゆう', hint: '__を説明する' },
      { kanji: '意見', reading: 'いけん', hint: '__を発表する' },
      { kanji: '発表', reading: 'はっぴょう', hint: '意見を__する' },
      { kanji: '手紙', reading: 'てがみ', hint: '案内の__' },
      { kanji: '段落', reading: 'だんらく', hint: '__の関係' },
      { kanji: '中心', reading: 'ちゅうしん', hint: '__となる題材' },
      { kanji: '道具', reading: 'どうぐ', hint: '便利な__' },
    ],
    write: [
      { kanji: '理由', reading: 'りゆう', hint: '__を説明する' },
      { kanji: '説明', reading: 'せつめい', hint: '理由を__する' },
      { kanji: '意見', reading: 'いけん', hint: '__を発表する' },
      { kanji: '発表', reading: 'はっぴょう', hint: '意見を__する' },
      { kanji: '案内', reading: 'あんない', hint: '__の手紙' },
      { kanji: '手紙', reading: 'てがみ', hint: '案内の__' },
      { kanji: '段落', reading: 'だんらく', hint: '__の関係' },
      { kanji: '関係', reading: 'かんけい', hint: '段落の__' },
      { kanji: '中心', reading: 'ちゅうしん', hint: '__となる題材' },
      { kanji: '題材', reading: 'だいざい', hint: '中心となる__' },
      { kanji: '便利', reading: 'べんり', hint: '__な道具' },
      { kanji: '道具', reading: 'どうぐ', hint: '便利な__' },
      { kanji: '国旗', reading: 'こっき', hint: '__を掲げる' },
      { kanji: '観光', reading: 'かんこう', hint: '__地をたずねる' },
      { kanji: '試みる', reading: 'こころみる', hint: '実験を__' },
      { kanji: '選ぶ', reading: 'えらぶ', hint: '選手を__' },
    ],
  },
]

export const LESSON_NUMBERS = LESSONS.map((l) => l.no)
export const MIN_LESSON = Math.min(...LESSON_NUMBERS)
export const MAX_LESSON = Math.max(...LESSON_NUMBERS)

export type Mode = 'read' | 'write'

export function collectItems(mode: Mode, fromNo: number, toNo: number) {
  const items: (ReadItem | WriteItem)[] = []
  for (const lesson of LESSONS) {
    if (lesson.no < fromNo || lesson.no > toNo) continue
    const arr = mode === 'read' ? lesson.read : lesson.write
    for (const it of arr) items.push({ ...it })
  }
  return items
}

// ひらがな・カタカナを正規化して比較
export function normalizeKana(s: string): string {
  if (!s) return ''
  let out = s
    .replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60)) // カタ→ひら
    .replace(/[ーｰ−-]/g, 'ー')
    .replace(/\s+/g, '')
    .replace(/[。、．，.,!?！？「」『』・]/g, '')
  return out
}
