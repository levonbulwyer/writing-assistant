// Every word list the checker uses lives in this one file.
// Edit a list, run `npm run build`, and the new rules are in dist/writing-assistant.html.
// Your own phrases can also be added from Settings inside the app, with no rebuild.

// Filler words. Flagged with a one-click "Remove".
export const FILLER = [
  'just', 'very', 'really', 'basically', 'actually', 'literally', 'quite',
  'simply', 'totally', 'honestly', 'definitely', 'certainly', 'extremely',
  'I think', 'I feel', 'I believe', 'kind of', 'sort of', 'a bit',
];

// Wordy phrase → plain swap. An empty swap means "delete it".
// A swap of null means there is no automatic fix; the message explains what to do.
export const WORDY = [
  ['in order to', 'to'],
  ['utilise', 'use'], ['utilize', 'use'], ['utilised', 'used'], ['utilising', 'using'],
  ['utilisation', 'use'],
  ['at this point in time', 'now'], ['at the present time', 'now'], ['at this time', 'now'],
  ['due to the fact that', 'because'], ['owing to the fact that', 'because'],
  ['on the grounds that', 'because'],
  ['in the event that', 'if'],
  ['prior to', 'before'], ['subsequent to', 'after'],
  ['with regard to', 'about'], ['with regards to', 'about'], ['in regard to', 'about'],
  ['in relation to', 'about'], ['regarding', 'about'],
  ['a large number of', 'many'], ['a number of', 'some'], ['the majority of', 'most'],
  ['in spite of the fact that', 'although'], ['despite the fact that', 'although'],
  ['for the purpose of', 'for'],
  ['on a daily basis', 'daily'], ['on a weekly basis', 'weekly'], ['on a regular basis', 'regularly'],
  ['in close proximity to', 'near'],
  ['is able to', 'can'], ['are able to', 'can'], ['has the ability to', 'can'],
  ['make a decision', 'decide'], ['take into consideration', 'consider'],
  ['give consideration to', 'consider'],
  ['please do not hesitate to contact', 'please contact'],
  ["please don't hesitate to contact", 'please contact'],
  ['do not hesitate to contact', 'please contact'],
  ['I am writing to inform you that', ''], ['I am writing to let you know that', ''],
  ['please be advised that', ''], ['please note that', ''], ['it should be noted that', ''],
  ['kindly', 'please'],
  ['per our conversation', 'as we discussed'], ['as per', 'as'],
  ['going forward', 'from now on'],
  ['reach out to', 'contact'], ['reach out', 'get in touch'],
  ['touch base', 'talk'],
  ['commence', 'start'], ['commenced', 'started'],
  ['terminate', 'end'], ['terminated', 'ended'],
  ['purchase', 'buy'], ['purchased', 'bought'],
  ['assist', 'help'], ['assistance', 'help'], ['assisted', 'helped'],
  ['endeavour', 'try'], ['facilitate', 'help'],
  ['whether or not', 'whether'], ['until such time as', 'until'],
  ['at all times', 'always'],
  ['each and every', 'every'], ['first and foremost', 'first'],
  ['at your earliest convenience', null, 'Vague. Give a date, such as "by Friday 10 October".'],
  ['as soon as possible', null, 'Vague. Give a date or time if you can.'],
  ['ASAP', null, 'Vague. Give a date or time if you can.'],
  ['we apologise for any inconvenience caused', "we're sorry for the trouble this caused"],
  ['we apologise for any inconvenience', "we're sorry for the trouble"],
];

// Your workplace list: phrases to avoid, with a better option.
// These are the defaults; the app lets you edit this list in Settings.
export const AVOID_DEFAULT = [
  { phrase: 'you failed to', swap: "we haven't received", why: 'Sounds like blame.' },
  { phrase: 'you must', swap: 'please', why: 'Sounds like an order.' },
  { phrase: 'as I said', swap: '', why: 'Can read as impatient.' },
  { phrase: 'as previously stated', swap: '', why: 'Can read as impatient.' },
  { phrase: 'obviously', swap: '', why: 'Can make the reader feel slow.' },
  { phrase: 'calm down', swap: null, why: 'Escalates. Acknowledge the frustration instead.' },
  { phrase: 'no problem', swap: 'happy to help', why: 'Sounds offhand in a complaint reply.' },
  { phrase: 'per policy', swap: 'under our policy', why: 'Sounds cold.' },
  { phrase: 'unfortunately', swap: null, why: 'Use once at most. Lead with what you can do.' },
];

// Words not to flag as repeats (they repeat in normal writing).
export const REPEAT_STOPWORDS = new Set(`a an the and or but if so to of in on at by for from with as is are was were be been
being am do does did have has had will would can could should may might must i me my we us our you your
he she it they them their this that these those not no yes please thank thanks there here then than
what which who when where how all any some each more most very just also up out about into over after`.split(/\s+/));

// Short ALL CAPS words that are normal acronyms and fine to keep.
export const ACRONYMS = new Set(`NZ NZD AU AUD US USD UK EU IRD ACC GST NZTA MSD WINZ NHI ID PIN PDF URL FAQ CEO CFO
IT HR OK TV USB KPI AM PM NB PS ETA ASAP EOD COB SMS DM CC BCC FYI RE FW FWD ATM EFTPOS IRD DOB T&C
Q1 Q2 Q3 Q4 API IVR CRM QA SLA`.split(/\s+/));

// Adjectives that look like passive voice after is/are/was ("I was pleased") and should not be flagged.
export const NOT_PASSIVE = new Set(`interested tired pleased concerned excited worried surprised bored married supposed used
related involved located based disappointed satisfied scared annoyed delighted frustrated confused embarrassed
prepared qualified limited detailed experienced advanced complicated dedicated sophisticated committed
aware able unable glad sorry happy closed open opened engaged determined amazed upset stressed relieved
thrilled exhausted overwhelmed`.split(/\s+/));

// Irregular past participles used to spot passive voice ("was sent", "has been paid").
export const IRREGULAR_PARTICIPLES = `done made given taken sent told seen known written paid shown found held kept left built
brought bought caught taught thought sold chosen broken spoken forgotten begun drawn driven eaten fallen
flown frozen hidden ridden risen shaken stolen sworn torn worn woken beaten bitten cut put set read hit
hurt lost met run spent understood won lent dealt sent shut split spread sung sunk struck forgiven
mistaken overtaken undertaken withdrawn`.split(/\s+/);

// Words the spell checker should know: New Zealand and te reo Māori words common in work email.
export const NZ_WORDS = `Aotearoa whānau whanau kia ora Kia Ora mōrena morena tēnā tena koe kōrua koutou ngā nga mihi
Ngā Nga Mihi aroha mahi kai hui iwi hapū hapu marae kaupapa tikanga mana manaaki manaakitanga
kaitiaki kaitiakitanga tamariki rangatahi kaumātua kaumatua pākehā pakeha haere mai nau rā ra
wairua whakapapa whenua kōrero korero ka pai kei te pēhea pehea Tāmaki Makaurau Ōtautahi Otautahi
Te Whanganui-a-Tara Kirikiriroa Ōtepoti Otepoti jandals chilly bin dairy tramping tramp bach crib
togs gumboots Waitangi Matariki Kiwi Kiwis Kiwisaver KiwiSaver EFTPOS Eftpos Ltd NZ`.split(/\s+/);

// Sample texts, used by "Try a sample" and by the tests.
export const SAMPLES = [
  {
    id: 'messy',
    name: 'Messy paste',
    text: `hi Sarah,

thanks for your email.  i have looked into the delivery and it was sent
on tuesday from our auckland depot.  the courier says it should arrive by
friday.

if it doesnt arrive , let me know and i'll chase it up.

cheers
Jordan`,
  },
  {
    id: 'wordy',
    name: 'Wordy reply',
    text: `Dear Mr Patel,

I am writing to inform you that we have received your complaint with regard to the late refund. In order to resolve this, we will need to utilise the information that was provided by you prior to the 3rd of September. Please be advised that the refund was processed by our team on a daily basis, and we are basically just waiting for the bank to confirm, which honestly could take a number of days due to the fact that banks are very slow at this point in time.

Please do not hesitate to contact us at your earliest convenience.

Kind regards,
Alex`,
  },
  {
    id: 'complaint',
    name: 'Complaint reply',
    text: `Kia ora Mere,

Thank you for letting us know about the missed appointment on Monday, and I'm sorry for the trouble it caused.

I have checked the booking and found that the technician was sent to the wrong address. I have corrected the address on your account and booked a new visit for Thursday 9 October between 8am and 12pm.

You'll get a text the evening before. If that time doesn't suit, reply to this email by Wednesday and I'll find another slot.

Ngā mihi,
Sam`,
  },
  {
    id: 'shouty',
    name: 'Blunt email',
    text: `Hi team,

You failed to send the report AGAIN!! As I said last week the report must be sent by Friday. This is VERY IMPORTANT and obviously the the deadline is not optional. Please send it ASAP!

Thanks`,
  },
  {
    id: 'fine',
    name: 'Already fine',
    text: `Hi Priya,

Thanks for sending the signed form. I have added it to your account.

Your new plan starts on 1 November. Your first bill will arrive in the second week of November.

Please reply by Friday 31 October if you want to change the start date.

Kind regards,
Leon`,
  },
];

// Example templates that fill the library on first run, so it can be tried straight away.
export const EXAMPLE_TEMPLATES = [
  {
    title: 'Missed appointment, new booking made',
    type: 'complaint',
    labels: { topic: ['Appointment'], situation: ['Apology'], tone: ['Warm'] },
    note: 'Says sorry once, explains the cause in one line, and gives a new time with a reply-by date.',
    text: `Kia ora {{Customer name}},

Thank you for letting us know about the missed appointment on {{Date}}, and I'm sorry for the trouble it caused.

I have checked the booking and found that {{What went wrong}}. I have booked a new visit for {{Date}} between {{Time window}}.

If that time doesn't suit, reply to this email by {{Date}} and I'll find another slot.

Ngā mihi,
{{Your name}}`,
  },
  {
    title: 'Refund processed, waiting on bank',
    type: 'email',
    labels: { topic: ['Refund'], situation: ['Follow-up'], tone: ['Neutral'] },
    note: 'Gives the amount, the date it was sent and when to expect it, so the customer has no need to call back.',
    text: `Hi {{Customer name}},

We sent your refund of {{Amount}} on {{Date}}. Banks usually take 3 to 5 working days to show it in your account.

If it hasn't arrived by {{Date}}, reply to this email with your reference {{Reference number}} and I'll follow it up with our payments team.

Kind regards,
{{Your name}}`,
  },
  {
    title: 'Request declined, with an alternative',
    type: 'complaint',
    labels: { topic: ['Account'], situation: ['Declined request'], tone: ['Firm'] },
    note: 'States the no plainly, gives the reason once, then moves straight to what we can do.',
    text: `Hi {{Customer name}},

Thanks for your request to {{What they asked for}}. We can't do that, because {{Reason}}.

What we can do is {{Alternative}}. If you'd like that, reply by {{Date}} and I'll set it up.

Kind regards,
{{Your name}}`,
  },
];

// Label choices offered when saving a template. New labels added in the app are kept too.
export const LABEL_GROUPS = [
  { key: 'topic', name: 'Topic', options: ['Billing', 'Refund', 'Delivery', 'Account', 'Appointment', 'Technical', 'Cancellation'] },
  { key: 'situation', name: 'Situation', options: ['First contact', 'Follow-up', 'Apology', 'Escalation', 'Declined request', 'Good news'] },
  { key: 'tone', name: 'Tone', options: ['Warm', 'Neutral', 'Firm'] },
];
