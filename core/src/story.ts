/**
 * Town story scenes. One or more per building (= chapter). Each is a short, spoken scene: listen, notice a word, make a decision, see the consequence.
 * No long cutscenes, no punishment: a poor choice gets a kind explanation and another try, and every scene ends on the best choice and the reason.
 * All words used here are curated senses, so they can be saved and practised immediately with checked practice.
 * Hindi lines are author drafts, not reviewed by a native editor (`STORY_STATUS`).
 */
export const STORY_STATUS = 'author-draft-unreviewed' as const;

export interface ChoiceOption { text: string; hi?: string; outcome: 'best' | 'ok' | 'poor'; reply: string; why: string }
export type Beat =
  | { kind: 'say'; who: string; text: string; hi?: string }
  | { kind: 'word'; senseId: string; note: string }                                   // a new word appears; the learner may save it
  | { kind: 'choose'; who: string; prompt: string; hi?: string; options: ChoiceOption[] }
  | { kind: 'end'; summary: string };

export interface Scene { id: string; building: string; title: string; focus: string; beats: Beat[] }

const say = (who: string, text: string, hi?: string): Beat => ({ kind: 'say', who, text, hi });

export const SCENES: Scene[] = [
  {
    id: 'home-tea', building: 'home', title: 'Tea with Nani', focus: 'polite, blunt',
    beats: [
      say('Nani', 'Beta, could you please bring me a cup of tea?', 'बेटा, क्या तुम मेरे लिए एक कप चाय ला सकोगे?'),
      say('Narrator', 'Nani said “could you please”. That is a polite way to ask.', 'नानी ने “could you please” कहा। यह माँगने का विनम्र तरीका है।'),
      { kind: 'word', senseId: 'polite.adj.1', note: 'Polite means having good manners.' },
      say('Bittu', 'Nani, your tea is too sweet. It is terrible!', 'नानी, आपकी चाय बहुत मीठी है। बहुत ख़राब है!'),
      say('Narrator', 'Nani looks sad. Bittu said it in a very direct way, with no softness at all.'),
      { kind: 'choose', who: 'You', prompt: 'What do you say to Bittu?', hi: 'तुम बिट्टू से क्या कहोगे?', options: [
        { text: '“You are right, it is terrible!”', outcome: 'poor', reply: 'Nani looks even sadder.', why: 'Agreeing with a harsh remark hurts the person who made the tea.' },
        { text: '“Bittu, that was blunt. You can say: a little less sugar, please.”', hi: '“बिट्टू, यह बहुत सीधा था। कहो: थोड़ी कम चीनी, कृपया।”', outcome: 'best', reply: 'Nani smiles. Bittu says: “A little less sugar, please, Nani.”', why: 'Blunt means saying it straight with no softening. You gave him a kinder way to say the same thing.' },
        { text: '“Be quiet!”', outcome: 'ok', reply: 'Bittu goes silent, but Nani is still upset.', why: 'It stops him, but it is also unkind. Showing a better way works better.' },
      ] },
      { kind: 'word', senseId: 'blunt.adj.1', note: 'Blunt means honest but with no care for feelings.' },
      { kind: 'end', summary: 'You met two words: polite and blunt. Nani got her tea, and a kinder brother.' },
    ],
  },
  {
    id: 'market-hint', building: 'market', title: 'A Hint at the Stall', focus: 'indirect',
    beats: [
      say('Mr. Sood', 'These mangoes look very nice, Meena. I saw the same ones at the next stall. Their price was lower…', 'ये आम बहुत अच्छे हैं, मीना। मैंने अगली दुकान पर यही आम देखे। उनका दाम कम था…'),
      say('Meena', 'Psst. He did not ask for a discount, but he is hinting. That is being indirect.', 'श्श्श। उन्होंने छूट नहीं माँगी, पर इशारा दिया। इसे indirect होना कहते हैं।'),
      { kind: 'word', senseId: 'indirect.adj.1', note: 'Indirect means not saying it straight; hinting.' },
      { kind: 'choose', who: 'Meena', prompt: 'What does Mr. Sood really want?', hi: 'मिस्टर सूद असल में क्या चाहते हैं?', options: [
        { text: 'A lower price.', hi: 'कम दाम।', outcome: 'best', reply: 'Meena nods. “Yes. He is asking, without asking.”', why: 'He said nothing about a discount, but comparing prices is a hint. That is what indirect means.' },
        { text: 'To tell me about the next stall.', outcome: 'poor', reply: 'Meena laughs kindly. “He wants more than a story.”', why: 'He mentioned it for a reason. When someone hints, ask what they want without saying it.' },
        { text: 'To buy nothing.', outcome: 'ok', reply: 'Meena shakes her head. “If he wanted nothing, he would have walked away.”', why: 'He is still standing at the stall. Hints usually mean “please offer something”.' },
      ] },
      say('Meena', 'Mr. Sood, I can give you a small discount today.', 'मिस्टर सूद, आज मैं थोड़ी छूट दे सकती हूँ।'),
      say('Mr. Sood', 'That is very kind of you!', 'आप बहुत दयालु हैं!'),
      { kind: 'end', summary: 'You noticed a hint. Indirect words save feelings, but they need careful listening.' },
    ],
  },
  {
    id: 'school-flood', building: 'school', title: 'A Bit Wet', focus: 'understatement',
    beats: [
      say('Narrator', 'It rained all night. In the morning the school floor is under water. Books are floating.', 'रात भर बारिश हुई। सुबह स्कूल का फ़र्श पानी में डूबा है। किताबें तैर रही हैं।'),
      say('Teacher Jas', 'Well, children. It is a bit wet in here.', 'तो बच्चों। यहाँ थोड़ा गीला है।'),
      { kind: 'word', senseId: 'understatement.n.1', note: 'An understatement makes something big sound small.' },
      { kind: 'choose', who: 'You', prompt: 'Teacher Jas said “a bit wet”. What is she doing?', hi: 'टीचर जस ने कहा “थोड़ा गीला”। वे क्या कर रही हैं?', options: [
        { text: 'Making a big problem sound small, to be funny.', hi: 'बड़ी समस्या को छोटा बताकर मज़ाक कर रही हैं।', outcome: 'best', reply: 'The class laughs. Teacher Jas smiles. “Yes. Now let us find the mops.”', why: 'The floor is flooded, but she said “a bit wet”. That is an understatement, often used for humour or to stay calm.' },
        { text: 'Telling the exact truth.', outcome: 'poor', reply: 'A student giggles. “Miss, it is a lake!”', why: 'A flooded floor is much more than “a bit wet”, so it is not exact. She made it sound smaller.' },
        { text: 'Making it sound even worse.', outcome: 'poor', reply: 'Teacher Jas raises an eyebrow. “Worse?”', why: 'Making it sound bigger is an exaggeration, the opposite of an understatement.' },
      ] },
      say('Teacher Jas', 'Everyone: shoes off, books up, and let us tidy this together.', 'सब: जूते उतारो, किताबें ऊपर रखो, और मिलकर सफ़ाई करें।'),
      { kind: 'end', summary: 'An understatement can calm a room. Just make sure everyone knows how big the problem really is.' },
    ],
  },
  {
    id: 'cafe-dish', building: 'cafe', title: 'The Nervous Chef', focus: 'tactful',
    beats: [
      say('Ravi', 'I made a new dish today. Be honest with me: is it good?', 'आज मैंने नया व्यंजन बनाया। सच बताना: कैसा है?'),
      say('Narrator', 'You taste it. It is far too salty. Ravi is watching your face.', 'तुम चखते हो। यह बहुत नमकीन है। रवि तुम्हारा चेहरा देख रहा है।'),
      { kind: 'choose', who: 'You', prompt: 'What do you say?', hi: 'तुम क्या कहोगे?', options: [
        { text: '“It is too salty. It is bad.”', outcome: 'poor', reply: 'Ravi’s smile disappears. He puts the spoon down.', why: 'It is honest, but it gives no help and it hurts. That is blunt, not tactful.' },
        { text: '“The flavours are bold! Try a little less salt and it will be perfect.”', hi: '“स्वाद तेज़ है! नमक थोड़ा कम करो, बिल्कुल बढ़िया होगा।”', outcome: 'best', reply: 'Ravi nods and tastes it again. “Less salt. Thank you, my friend.”', why: 'You told the truth and protected his feelings. That is being tactful.' },
        { text: '“It is perfect!”', outcome: 'ok', reply: 'Ravi beams, but the next customer will taste the salt.', why: 'It is kind, but not honest, so it does not help him. Tactful means honest and caring together.' },
      ] },
      { kind: 'word', senseId: 'tactful.adj.1', note: 'Tactful means careful not to upset people.' },
      say('Ravi', 'Next time, the salt will be right. Sit down, I will bring tea.', 'अगली बार नमक ठीक होगा। बैठो, मैं चाय लाता हूँ।'),
      { kind: 'end', summary: 'Being tactful means telling the truth in a way that helps.' },
    ],
  },
  {
    id: 'workshop-letgo', building: 'workshop', title: 'Let Go', focus: 'euphemism',
    beats: [
      say('Mr. Kapoor', 'Because of restructuring, some colleagues will be let go this Friday.', 'पुनर्गठन की वजह से इस शुक्रवार कुछ साथियों को छोड़ना पड़ेगा।'),
      say('Narrator', 'The room goes quiet. Nobody says the hard word.', 'कमरा शांत हो जाता है। कोई कठिन शब्द नहीं बोलता।'),
      { kind: 'choose', who: 'You', prompt: 'What does “let go” really mean here?', hi: 'यहाँ “let go” का असली मतलब क्या है?', options: [
        { text: 'They will lose their jobs.', hi: 'उनकी नौकरी चली जाएगी।', outcome: 'best', reply: 'Anil, at the next desk, looks down. He heard it too.', why: '“Let go” is a softer way to say “fired” or “made to leave the job”. That is a euphemism.' },
        { text: 'They will go home early.', outcome: 'poor', reply: 'A colleague whispers: “No. It means their jobs are ending.”', why: 'Softer wording can hide something hard. Here “let go” hides that jobs are ending.' },
        { text: 'They will get a new job.', outcome: 'poor', reply: 'Nobody is smiling. That would not be said so quietly.', why: 'The quiet room is a clue. A euphemism often covers unwelcome news.' },
      ] },
      { kind: 'word', senseId: 'euphemism.n.1', note: 'A euphemism is a gentle way of saying something hard.' },
      say('Anil', 'It is my job they mean. I have three children.', 'मेरी नौकरी की बात है। मेरे तीन बच्चे हैं।'),
      { kind: 'choose', who: 'You', prompt: 'How do you speak to Anil?', hi: 'तुम अनिल से कैसे बात करोगे?', options: [
        { text: '“I am sorry you may lose your job. I will help you look for another.”', hi: '“मुझे दुख है कि आपकी नौकरी जा सकती है। मैं नई नौकरी ढूँढने में मदद करूँगा।”', outcome: 'best', reply: 'Anil breathes out. “Thank you. That means a lot.”', why: 'You said the true thing clearly and kindly, and offered help.' },
        { text: '“Do not worry, it will be fine!”', outcome: 'ok', reply: 'Anil manages a thin smile.', why: 'It is kind, but it may not be true. He needs honesty with care.' },
        { text: '“Everyone loses a job sometimes.”', outcome: 'poor', reply: 'Anil turns away.', why: 'This shrinks his worry. Say what happened and offer help.' },
      ] },
      { kind: 'end', summary: 'A euphemism can be kind, but it can also hide the truth. Now you can notice the difference.' },
    ],
  },
  {
    id: 'clinic-words', building: 'clinic', title: 'Careful Words', focus: 'euphemism, tactful',
    beats: [
      say('Narrator', 'Dr. Asha is speaking to a family. A small girl, Simran, is listening.', 'डॉ. आशा एक परिवार से बात कर रही हैं। छोटी सिमरन सुन रही है।'),
      say('Dr. Asha', 'I am so sorry. Your grandfather passed away peacefully this morning.', 'मुझे बहुत दुख है। आपके दादाजी आज सुबह शांति से चल बसे।'),
      say('Simran', 'Passed away? Where did he go?', 'चल बसे? वे कहाँ गए?'),
      { kind: 'choose', who: 'Dr. Asha', prompt: 'How should Dr. Asha explain it to a child?', hi: 'डॉ. आशा को बच्ची को कैसे समझाना चाहिए?', options: [
        { text: '“Passed away is a gentle way to say he died. He will not come back, and it is okay to be sad.”', hi: '“Passed away का मतलब है वे गुज़र गए। वे वापस नहीं आएँगे, और उदास होना ठीक है।”', outcome: 'best', reply: 'Simran nods slowly and takes her mother’s hand.', why: '“Passed away” is a euphemism for died. Explaining it plainly and kindly helps a child understand and feel safe.' },
        { text: '“He went on a long trip.”', outcome: 'poor', reply: 'Simran asks: “When will he come back?”', why: 'A softer story can confuse a child. Gentle words work best when the meaning is also made clear.' },
        { text: '“Do not ask hard questions.”', outcome: 'poor', reply: 'Simran goes quiet and looks scared.', why: 'Questions are good. Tactful means careful and kind, not silent.' },
      ] },
      { kind: 'word', senseId: 'tactful.adj.1', note: 'Tactful means careful not to upset people.' },
      say('Dr. Asha', 'Take your time. I am here whenever you want to talk.', 'आराम से। जब भी बात करना चाहें, मैं यहाँ हूँ।'),
      { kind: 'end', summary: 'Gentle words and clear meaning together. That is how you speak about the hardest things.' },
    ],
  },
  {
    id: 'hall-meeting', building: 'hall', title: 'Disagreeing Kindly', focus: 'blunt, tactful',
    beats: [
      say('Sarpanch Kaur', 'Neighbours, I propose we close the road for the festival, for three whole days.', 'पड़ोसियो, मेरा सुझाव है कि त्योहार के लिए सड़क तीन पूरे दिन बंद कर दें।'),
      say('Narrator', 'You think three days is too long. The shopkeepers will lose customers.', 'तुम्हें लगता है तीन दिन बहुत लंबा है। दुकानदारों के ग्राहक कम हो जाएँगे।'),
      { kind: 'choose', who: 'You', prompt: 'How do you disagree?', hi: 'तुम असहमति कैसे जताओगे?', options: [
        { text: '“That is a stupid idea.”', outcome: 'poor', reply: 'The hall goes cold. Nobody listens after that.', why: 'It is blunt and insulting. It attacks the person, so no one hears your point.' },
        { text: '“I love the festival. Could we close the road for one day, so the shops can stay open?”', hi: '“मुझे त्योहार पसंद है। क्या सड़क एक दिन बंद कर सकते हैं ताकि दुकानें खुली रहें?”', outcome: 'best', reply: 'Sarpanch Kaur smiles. “A fair point. Let us talk about one or two days.”', why: 'You agreed with what you can, then offered a clear alternative. Tactful disagreement gets listened to.' },
        { text: 'Say nothing and go home.', outcome: 'ok', reply: 'The road is closed for three days, and the shops suffer.', why: 'Keeping quiet avoids a fight, but your idea is lost. Speaking kindly is braver.' },
      ] },
      { kind: 'word', senseId: 'blunt.adj.1', note: 'Blunt means honest but with no care for feelings.' },
      say('Sarpanch Kaur', 'Thank you for speaking up, and for how you said it.', 'बोलने के लिए धन्यवाद, और जिस ढंग से आपने कहा उसके लिए भी।'),
      { kind: 'end', summary: 'A good idea said unkindly is easy to ignore. Said kindly, it changes the meeting.' },
    ],
  },
  {
    id: 'library-flood', building: 'library', title: 'The Old Flood', focus: 'understatement',
    beats: [
      say('The Librarian', 'Sit, child. I will tell you about the great flood, long ago.', 'बैठो, बच्चे। मैं तुम्हें बहुत पहले की बड़ी बाढ़ के बारे में बताती हूँ।'),
      say('The Librarian', 'The river climbed to the second floor. My father looked out and said: “It is a bit damp today.”', 'नदी दूसरी मंज़िल तक चढ़ आई। मेरे पिताजी ने बाहर देखा और कहा: “आज थोड़ी नमी है।”'),
      { kind: 'choose', who: 'You', prompt: 'Why did her father say “a bit damp”?', hi: 'उनके पिता ने “थोड़ी नमी” क्यों कहा?', options: [
        { text: 'It was a joking understatement, to keep everyone calm.', hi: 'यह मज़ाक में कम करके कहना था, सबको शांत रखने के लिए।', outcome: 'best', reply: 'The Librarian laughs softly. “Exactly. It made us brave.”', why: 'A flood is huge, and “a bit damp” is tiny. Saying something big in a small way is an understatement, and it can comfort people.' },
        { text: 'He did not see the water.', outcome: 'poor', reply: 'The Librarian smiles. “Oh, he saw it very well.”', why: 'He saw the flood. The small words were on purpose.' },
        { text: 'He was frightened and shouting.', outcome: 'poor', reply: 'The Librarian shakes her head. “He was calm.”', why: 'Shouting would be the opposite. He stayed calm and made the danger sound small.' },
      ] },
      { kind: 'word', senseId: 'understatement.n.1', note: 'An understatement makes something big sound small.' },
      say('The Librarian', 'Words are how we keep each other steady. Keep collecting them.', 'शब्द ही हमें एक-दूसरे को थामे रखते हैं। इन्हें इकट्ठा करते रहो।'),
      { kind: 'end', summary: 'You have walked through the whole town of words. The story is yours to keep telling.' },
    ],
  },
];
export const SCENE_BY_ID: Record<string, Scene> = Object.fromEntries(SCENES.map(s => [s.id, s]));
export const SCENE_REWARD = { coins: 12, xp: 12 };

/** Structural validation for authored scenes. Says nothing about literary or linguistic quality: that needs a human editor. */
export function validateScenes(scenes: Scene[], senseIds: Set<string>, buildingIds: Set<string>): string[] {
  const p: string[] = []; const need = (c: unknown, m: string) => { if (!c) p.push(m); };
  need(new Set(scenes.map(s => s.id)).size === scenes.length, 'scene ids unique');
  for (const s of scenes) {
    const at = (m: string) => `${s.id}: ${m}`;
    need(buildingIds.has(s.building), at('unknown building'));
    need(s.beats.length >= 5 && s.beats.length <= 14, at('5-14 beats (short scenes)'));
    need(s.beats.at(-1)?.kind === 'end' && s.beats.filter(b => b.kind === 'end').length === 1, at('exactly one end, last'));
    need(s.beats.some(b => b.kind === 'word'), at('teaches at least one word')); need(s.beats.some(b => b.kind === 'choose'), at('has a decision'));
    need(s.beats.filter(b => b.kind === 'say').length >= 2, at('needs some dialogue'));
    for (const b of s.beats) {
      if (b.kind === 'say') { need(b.text.length <= 170 && b.text.trim(), at('line too long or empty')); need(!b.hi || b.hi.length <= 190, at('hindi line too long')); }
      if (b.kind === 'word') { need(senseIds.has(b.senseId), at(`unknown sense ${b.senseId}`)); need(b.note.length <= 120, at('word note too long')); }
      if (b.kind === 'choose') {
        need(b.options.length === 3, at('choose needs 3 options')); need(b.options.filter(o => o.outcome === 'best').length === 1, at('exactly one best option'));
        need(b.options.every(o => o.reply.trim() && o.why.trim()), at('every option needs a reply and a reason'));
        need(new Set(b.options.map(o => o.text)).size === 3, at('options must differ')); need(!/wrong|stupid|fail/i.test(b.options.map(o => o.why).join(' ')), at('reasons must not shame'));
      }
    }
  }
  return p;
}
