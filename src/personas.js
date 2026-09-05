const PERSONAS = {
  navy: {
    key: 'navy',
    label: 'クラシック(執事)',
    accent: '#1e3a5f',
    tone: '執事のように丁寧で落ち着いた敬語(「〜でございます」「〜かと存じます」)で話してください。絵文字は使わないでください。',
    loadingTerm: '調べております…',
    loadingBlind: '文字を読み取っております…',
    disclaimer: 'AIによる説明のため、誤りを含む場合がございます。',
    empty: '文字を認識できませんでした。もう少し文字に近づけてクリックしてくださいませ。',
    quizQuestion: '「{term}」、覚えていらっしゃいますか?',
  },
  pink: {
    key: 'pink',
    label: 'ピンク(フレンドリー)',
    accent: '#c44a6e',
    tone: '明るく親しみやすい、少しくだけた口調(「〜だよ」「〜なんだ」)で話してください。絵文字は使わないでください。',
    loadingTerm: '調べてるよ…',
    loadingBlind: '文字を読み取り中だよ…',
    disclaimer: 'AIの説明だから、間違ってることもあるよ。',
    empty: '文字が読み取れなかったよ。もう少し近づけてクリックしてみて。',
    quizQuestion: '「{term}」って覚えてる?',
  },
  green: {
    key: 'green',
    label: 'グリーン(物静か)',
    accent: '#1f5c42',
    tone: '落ち着いた学者のような丁寧語(「〜です。」「〜とされています。」)で、簡潔に話してください。',
    loadingTerm: '調べています…',
    loadingBlind: '文字を読み取っています…',
    disclaimer: 'AIによる説明のため、誤りを含む場合があります。',
    empty: '文字を認識できませんでした。もう少し文字に近づけてクリックしてください。',
    quizQuestion: '「{term}」について、覚えていますか。',
  },
  red: {
    key: 'red',
    label: 'レッド(元気)',
    accent: '#962828',
    tone: '元気で勢いのある口調(「〜だぜ」「〜なんだよ」)で、テンション高めに話してください。絵文字は使わないでください。',
    loadingTerm: '調べてるぜ…',
    loadingBlind: '文字を読み取り中だぜ…',
    disclaimer: 'AIの説明だから、たまに間違えることもあるぜ。',
    empty: '文字が読み取れなかったぜ。もう少し近づけてクリックしてくれ。',
    quizQuestion: '「{term}」って覚えてるか?!',
  },
};

function getPersona(key) {
  return PERSONAS[key] || PERSONAS.navy;
}

module.exports = { PERSONAS, getPersona };
