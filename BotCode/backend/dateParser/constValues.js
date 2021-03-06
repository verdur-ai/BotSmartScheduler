exports.Schedule = class {
    constructor() {
        this.time = {
            years: { locked: false, values: [] },
            months: { locked: false, values: [] },
            dates: { locked: false, values: [] },
            hours: { locked: false, values: [] },
            minutes: { locked: false, values: [] }
        }
        this.minTime = {
            years: 0,
            months: 0,
            dates: 0,
            hours: 0,
            minutes: 0
        }
        this.shouldIncreaseTime = false;
        this.shouldIncreaseHours = false;
        this.originalWords = '';
        this.words = '';
        this.usedWords = [];

        this.ComposedDate = 0;

        this.text = '';
    }
}
exports.MAX_WORDS_COUNT = 40;
exports.maxMonthLength = 31;
exports.maxMonthCount = 12;
exports.maxHoursPerDay = 23;
exports.maxMinutesPerHour = 59;
exports.maxYearAddition = 100;
exports.mainSeparators = /[ \r\n]+/;
exports.timeSeparators = [':', '.'];
exports.dateSeparator = '.';
exports.specialSymbols = ['@'];
exports.numbersDictionary = [
    { str: ['ноль', 'нулев'], end: false, val: 0, l: 0, n: 0, multiplier: false },
    { str: ['один', 'перв'], end: false, val: 1, l: 0, n: 1, multiplier: false },
    { str: ['одна'], end: false, val: 1, l: 0, n: 1, multiplier: true },
    { str: ['два', 'второ'], end: false, val: 2, l: 0, n: 1, multiplier: false },
    { str: ['две'], end: true, val: 2, l: 0, n: 1, multiplier: true },
    { str: ['третьего', 'третьих'], end: true, val: 3, l: 0, n: 1, multiplier: false },
    { str: ['три'], end: false, val: 3, l: 0, n: 1, multiplier: true },
    { str: ['четверто', 'четверты'], end: false, val: 4, l: 0, n: 1, multiplier: false },
    { str: ['четыре'], end: true, val: 4, l: 0, n: 1, multiplier: true },
    { str: ['пять', 'пятого', 'пяти'], end: true, val: 5, l: 0, n: 1, multiplier: true },
    { str: ['шест'], end: false, val: 6, l: 0, n: 1, multiplier: true },
    { str: ['седь'], end: false, val: 7, l: 0, n: 1, multiplier: false },
    { str: ['семь'], end: false, val: 7, l: 0, n: 1, multiplier: true },
    { str: ['восьм'], end: false, val: 8, l: 0, n: 1, multiplier: false },
    { str: ['восемь'], end: false, val: 8, l: 0, n: 1, multiplier: true },
    { str: ['девят'], end: false, val: 9, l: 0, n: 1, multiplier: true },
    { str: ['десят'], end: false, val: 10, l: 0, n: 2, multiplier: true },
    { str: ['одиннад'], end: false, val: 11, l: 0, n: 2, multiplier: true },
    { str: ['двенад'], end: false, val: 12, l: 0, n: 2, multiplier: true },
    { str: ['тринад'], end: false, val: 13, l: 0, n: 2, multiplier: true },
    { str: ['четырнад'], end: false, val: 14, l: 0, n: 2, multiplier: true },
    { str: ['пятнад'], end: false, val: 15, l: 0, n: 2, multiplier: true },
    { str: ['шестнад'], end: false, val: 16, l: 0, n: 2, multiplier: true },
    { str: ['семнад'], end: false, val: 17, l: 0, n: 2, multiplier: true },
    { str: ['восемнад'], end: false, val: 18, l: 0, n: 2, multiplier: true },
    { str: ['девятнад'], end: false, val: 19, l: 0, n: 2, multiplier: true },
    { str: ['двадц'], end: false, val: 20, l: 1, n: 2, multiplier: true },
    { str: ['тридц'], end: false, val: 30, l: 1, n: 2, multiplier: true },
    { str: ['сорок', 'сорокового', 'сороковых', 'сороковое'], end: true, val: 40, l: 1, n: 2, multiplier: true },
    { str: ['пятьдес'], end: false, val: 50, l: 1, n: 2, multiplier: true },
    { str: ['шестьдес'], end: false, val: 60, l: 1, n: 2, multiplier: true },
    { str: ['семьдес'], end: false, val: 70, l: 1, n: 2, multiplier: true },
    { str: ['восемьдес'], end: false, val: 80, l: 1, n: 2, multiplier: true },
    { str: ['девянос'], end: false, val: 90, l: 1, n: 2, multiplier: true },
    { str: ['сто'], end: true, val: 100, l: 2, n: 3, multiplier: true },
    { str: ['сотый', 'сотого', 'сотые'], end: false, val: 100, l: 2, n: 3, multiplier: false },
    { str: ['двест'], end: false, val: 200, l: 2, n: 3, multiplier: true },
    { str: ['трист'], end: false, val: 300, l: 2, n: 3, multiplier: true },
    { str: ['четырест'], end: false, val: 400, l: 2, n: 3, multiplier: true },
    { str: ['пятьсот'], end: false, val: 500, l: 2, n: 3, multiplier: true },
    { str: ['шестьсот'], end: false, val: 600, l: 2, n: 3, multiplier: true },
    { str: ['семьсот'], end: false, val: 700, l: 2, n: 3, multiplier: true },
    { str: ['восемьсот'], end: false, val: 800, l: 2, n: 3, multiplier: true },
    { str: ['девятьсот'], end: false, val: 900, l: 2, n: 3, multiplier: true },
    { str: ['тысяча'], end: false, val: 1000, l: 3, n: 4, multiplier: false },
    { str: ['тысячу'], end: false, val: 1000, l: 3, n: 4, multiplier: false },
    { str: ['тысячи'], end: false, val: 1000, l: 3, n: 4, multiply: true, n: 0, multiplier: false },
].reverse();

const softSignedEnding = ['ь', 'я', 'е'];
exports.softSignedEnding = softSignedEnding;
exports.monthsRusRoot = [
    'январ',
    'феврал',
    'март',
    'апрел',
    'ма',
    'июн',
    'июл',
    'август',
    'сентябр',
    'октябр',
    'ноябр',
    'декабр'
];
exports.monthsRusEnding = [
    softSignedEnding,
    softSignedEnding,
    ['', 'а', 'е'],
    softSignedEnding,
    ['й', 'я', 'е'],
    softSignedEnding,
    softSignedEnding,
    ['', 'а', 'е'],
    softSignedEnding,
    softSignedEnding,
    softSignedEnding,
    softSignedEnding
];
exports.priorityTools = {
    max: 100,
    min: 1,
    increase: 25
};
exports.offsetLiterals = {
    dates: [
        { string: 'завтра', offset: 1 },
        { string: 'послезавтра', offset: 2 }
    ]
};
exports.additiveWord = 'через';

const numModes = { "use": 0, "require": 1, "ignore": 2 };
exports.numModes = numModes;
exports.additiveLiterals = {
    years: [
        { string: 'лет', multiplyer: 1, mode: numModes.require },
        { string: 'год', multiplyer: 1, mode: numModes.use }
    ],
    months: [
        { string: 'месяц', multiplyer: 1, mode: numModes.use }
    ],
    dates: [
        { string: 'дне', multiplyer: 1, mode: numModes.require },
        { string: 'дня', multiplyer: 1, mode: numModes.require },
        { string: 'ден', multiplyer: 1, mode: numModes.use },
        { string: 'недел', multiplyer: 7, mode: numModes.use }
    ],
    hours: [
        { string: 'час', multiplyer: 1, mode: numModes.use }
    ],
    minutes: [
        { string: 'мин', multiplyer: 1, mode: numModes.use },
        { string: 'полчаса', multiplyer: 30, mode: numModes.ignore }
    ]
};
exports.hourTimeOfDayDefiners = [
    { strings: ['дня', 'вечер', 'обед'], lesser: false },
    { strings: ['ноч', 'утр'], lesser: true }
];
exports.daysOfWeak = [
    { names: ['воскр'], number: 0 },
    { names: ['понед'], number: 1 },
    { names: ['вторн'], number: 2 },
    { names: ['среда', 'среду'], number: 3 },
    { names: ['четверг'], number: 4 },
    { names: ['пятниц'], number: 5 },
    { names: ['суббот'], number: 6 },
];
exports.integerWordsTypeDefiners = {
    years: [{ string: 'год' }],
    months: [{ string: 'месяц' }],
    dates: [{ string: 'числ' }],
    hours: [{ string: 'час' }],
    minutes: [{ string: 'мин' }]
};
exports.integerWordsDefaultValues = {
    years: 0,
    months: 1,
    dates: 1,
    hours: 0,
    minutes: 0
};
exports.integerHoursAdditionalDefiners = [
    {
        strings: [
            'пол',
            'половин'
        ], needNum: false, val: 30,
    },
    {
        strings: [
            'четверть'
        ], needNum: false, val: 15
    },
    {
        strings: [
            'без'
        ], needNum: true
    }
];