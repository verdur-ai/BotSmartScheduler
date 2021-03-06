const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const DateParser = require('../../backend/dateParser/dateParser');
const MiscFunctions = require('../../backend/dateParser/miscFunctions');
const rp = require('../replies/replies');

let incomingMsgTimer = []
let incomingMsgCtxs = []

//#region functions
function GetDeletingIDsIndex (chatID, deletingIDs) {
    if (deletingIDs.length) {
        for (let i in deletingIDs) {
            if (deletingIDs[i].chatID == chatID) {
                return i;
            }
        }
    }
    return false;
}
function FormatChatId (id) {
    id = id.toString(10);
    if (id[0] == '-') {
        id = '_' + id.substring(1);
    }
    return id;
}
async function LoadSchedulesList (chatID, tsOffset, db) {
    let schedules = await db.ListSchedules(chatID);
    if (schedules !== false) {
        let answer = ``;
        schedules.sort((a, b) => (a.id > b.id) ? 1 : ((b.id > a.id) ? -1 : 0));
        for (let schedule of schedules) {
            let scheduledBy = '';
            if (schedule.username != 'none') {
                scheduledBy = ` by <b>${schedule.username}</b>`;
            }
            answer += `/${schedule.id}. "${schedule.text}"${scheduledBy}: <b>${MiscFunctions.FormDateStringFormat(new Date(+schedule.ts + tsOffset * 1000))}</b>\r\n`;
        }
        return answer;
    } else {
        return rp.listIsEmpty;
    }
}
async function StartTimeZoneDetermination (ctx, db, tzPendingConfirmationUsers) {
    let curTZ = await db.GetUserTZ(ctx.from.id);
    let reply = '';
    if (curTZ !== 0) {
        reply = rp.tzCurrent(curTZ) + '\r\n';
    }
    let isPrivateChat = ctx.chat.id >= 0;
    if (isPrivateChat) {
        reply += rp.tzPrivateChat;
        try {
            return ctx.replyWithHTML(reply, Markup
                .keyboard([
                    [{ text: rp.tzUseLocation, request_location: true }, { text: rp.tzTypeManually }],
                    [{ text: rp.tzCancel }]
                ]).oneTime()
                .removeKeyboard()
                .resize()
                .extra()
            );
        } catch (e) {
            console.error(e);
        }
    }
    reply += rp.tzGroupChat;
    if (tzPendingConfirmationUsers.indexOf(ctx.from.id) < 0) {
        tzPendingConfirmationUsers.push(ctx.from.id);
    }
    try {
        return ctx.replyWithHTML(rp.tzGroupChat);
    } catch (e) {
        console.error(e);
    }
}

async function CheckExpiredSchedules (bot, db) {
    console.log('Checking expired schedules ' + new Date());
    db.sending = true;
    let expiredSchedules = await db.CheckActiveSchedules(Date.now());
    if (expiredSchedules.length) {
        console.log(`expiredSchedules = ${JSON.stringify(expiredSchedules)}`);
        let ChatIDs = [];
        let deletingIDs = [];
        for (let schedule of expiredSchedules) {
            let chatID = schedule.chatid;
            if (chatID[0] == '_') {
                chatID = '-' + chatID.substring(1, chatID.length);
            }
            console.log(`Expired schedule = ${JSON.stringify(schedule)}`);
            if (!ChatIDs.includes(schedule.chatid)) {
                ChatIDs.push(schedule.chatid);
            }
            if (typeof (incomingMsgTimer[schedule.chatid]) != 'undefined') {
                clearTimeout(incomingMsgTimer[schedule.chatid]);
            }
            let mentionUser = '';
            if (schedule.username != 'none') {
                mentionUser = ' @' + schedule.username;
            }
            try {
                let msg = await bot.telegram.sendMessage(+chatID, `⏰${mentionUser} "${schedule.text}"`, Extra.markup((m) =>
                    m.inlineKeyboard([
                        m.callbackButton(rp.repeatSchedule, 'repeat')
                    ]).oneTime()
                ));
                setTimeout(function (msg) {
                    bot.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, Extra.markup((m) =>
                        m.inlineKeyboard([]).removeKeyboard()
                    ));
                }, repeatScheduleTime, msg);
            } catch (e) {
                console.error(e);
            }

            let index = GetDeletingIDsIndex(schedule.chatid, deletingIDs);
            if (index === false) {
                deletingIDs.push({ s: `id = ${schedule.id} OR `, chatID: schedule.chatid });
            } else {
                deletingIDs[index].s += `id = ${schedule.id} OR `;
            }
        }
        console.log('CHECKED, removing and reordering');
        for (let chatID of ChatIDs) {
            let index = GetDeletingIDsIndex(chatID, deletingIDs);
            if (index !== false) {
                let s = deletingIDs[index].s;
                s = s.substring(0, s.length - 4);
                await db.RemoveSchedules(chatID, s);
            }
            await db.ReorderSchedules(chatID);
        }
        console.log('Removed and reordered, Servicing incoming msgs');
        for (let chatID of ChatIDs) {
            let ctxs = incomingMsgCtxs[chatID];
            if (typeof (ctxs) != 'undefined' && ctxs.length) {
                await ServiceMsgs(incomingMsgCtxs[chatID], db);
            }
        }
        console.log(`Serviced incoming msgs`);
    }
    db.sending = false;
    console.log(`Done checking expired schedules`);
}

async function HandleTextMessage (ctx, db, tzPendingConfirmationUsers) {
    let chatID = FormatChatId(ctx.chat.id)
    if (tzPendingConfirmationUsers.indexOf(ctx.from.id) >= 0) {
        let userId = ctx.from.id;
        let matches = ctx.message.text.match(/(\+|-|–|—|)([0-9])+:([0-9])+/g);
        let hours, minutes, negative, ts;
        if (matches != null) {
            //Parse tz from msg;
            let offset = matches[0];
            let index = offset.indexOf(':');
            hours = parseInt(offset.substring(0, index));
            negative = offset[0].match(/-|–|—/g) != null;
            minutes = parseInt(offset.substring(index + 1));
            console.log(`Determining tz: offset = ${offset}, hours = ${hours}, minutes = ${minutes}, ts = ${ts}`);
        } else {
            matches = ctx.message.text.match(/(\+|-|–|—|)([0-9])+/g);
            if (matches != null) {
                let offset = matches[0];
                hours = parseInt(offset);
                minutes = 0;
                negative = offset[0].match(/-|–|—/g) != null;
                console.log(`Determining tz from only hour option: offset = ${offset}, hours = ${hours}, minutes = ${minutes}, ts = ${ts}`);
            }
        }
        if (matches != null) {
            let ts = hours * 3600;
            ts += minutes * 60 * (negative ? -1 : 1);
            if (await db.HasUserID(userId)) {
                await db.RemoveUserTZ(userId);
            }
            await db.AddUserTZ(userId, ts);
            tzPendingConfirmationUsers.splice(tzPendingConfirmationUsers.indexOf(ctx.from.id), 1);
            try {
                ctx.replyWithHTML(rp.tzCurrent(ts), rp.mainKeyboard);
            } catch (e) {
                console.error(e);
            }
        } else {
            console.log(`Can't determine tz in "${ctx.message.text}"`);
            try {
                return ctx.replyWithHTML(rp.tzInvalidInput, Extra.markup((m) =>
                    m.inlineKeyboard([
                        m.callbackButton(rp.tzCancel, 'tz cancel')
                    ]).oneTime()
                ));
            } catch (e) {
                console.error(e);
            }
        }
    } else {
        if (typeof (incomingMsgCtxs[chatID]) == 'undefined') {
            incomingMsgCtxs[chatID] = [];
        }
        incomingMsgCtxs[chatID].push(ctx);
        if (typeof (incomingMsgTimer[chatID]) != 'undefined') {
            clearTimeout(incomingMsgTimer[chatID]);
        }
        incomingMsgTimer[chatID] = setTimeout(() => {
            ServiceMsgs(incomingMsgCtxs[chatID], db);
            incomingMsgCtxs[chatID] = [];
        }, 1000);
    }
}

async function ServiceMsgs (ctxs, db) {
    let servicedMessages = [];
    let deletingSchedulesIDs = [];
    let chatID = ctxs[0].chat.id.toString();
    if (chatID[0] == '-') {
        chatID = '_' + chatID.substring(1, chatID.length);
    }
    let deleteAll = false;
    for (let ctx of ctxs) {
        let msgText = ctx.message.text;

        if (msgText[0] == '/') {
            let serviceRes = await ServiceCommand(ctx, db);
            if (typeof (serviceRes) != 'undefined') {
                if (serviceRes[0] == 'all' || deleteAll) {
                    deletingSchedulesIDs = ['all'];
                    deleteAll = true;
                } else {
                    deletingSchedulesIDs = deletingSchedulesIDs.concat(serviceRes);
                }
            }
        } else {
            let tz = await db.GetUserTZ(ctx.from.id);
            let parsedMessage = await DateParser.ParseDate(msgText, tz, process.env.ENABLE_LOGS != 'false');
            servicedMessages.push({ parsedMessage: parsedMessage, chatID: chatID, username: ctx.from.username, userID: ctx.from.id });
        }
    }
    let reply = '';
    let schedules = [];
    for (let servicedMessage of servicedMessages) {
        let isScheduled = await db.GetScheduleByText(servicedMessage.chatID, servicedMessage.parsedMessage.text);
        let tz = await db.GetUserTZ(servicedMessage.userID);
        let schedulesCount = (await db.GetSchedules(servicedMessage.chatID)).length;
        if (typeof (schedulesCount) == 'undefined') {
            schedulesCount = 0;
        }
        console.log(`schedulesCount = ${schedulesCount}`);
        let count = 0
        if (isScheduled !== false) {
            isScheduled = +isScheduled;
            reply += rp.scheduled(servicedMessage.parsedMessage.text, MiscFunctions.FormDateStringFormat(new Date(isScheduled + tz * 1000)));
        } else {
            if (count + schedulesCount < global.MaximumCountOfSchedules) {
                if (typeof (servicedMessage.parsedMessage.date) != 'undefined') {
                    schedules.push({ chatID: servicedMessage.chatID, text: servicedMessage.parsedMessage.text, timestamp: servicedMessage.parsedMessage.date.getTime(), username: servicedMessage.username });
                    reply += servicedMessage.parsedMessage.answer + `\r\n`;
                    count++;
                } else {
                    if (servicedMessage.chatID[0] !== '_') {
                        reply += servicedMessage.parsedMessage.answer + `\r\n`;
                    }
                }
                if (servicedMessage.chatID[0] !== '_' && !(await db.HasUserID(servicedMessage.userID))) {
                    reply += rp.tzWarning;
                }
            } else {
                reply += rp.exceededLimit(global.MaximumCountOfSchedules);
                break;
            }
        }
    }
    if (deletingSchedulesIDs.length) {
        if (deleteAll) {
            await db.ClearAllSchedules(chatID);
            reply += rp.cleared;
        } else {
            let s = '';
            for (let i in deletingSchedulesIDs) {
                let schedule = deletingSchedulesIDs[i];
                if (!isNaN(schedule)) s += `id = ${schedule} OR `;
                else deletingSchedulesIDs.splice(i, 1);
            }
            s = s.substring(0, s.length - 4);
            await db.RemoveSchedules(chatID, s)
            await db.ReorderSchedules(chatID);
            let end = '';
            if (deletingSchedulesIDs.length > 1) {
                end = 's';
            }

            reply += rp.deleted(deletingSchedulesIDs.join(', '), end, reply.length > 0);
        }
    }
    if (schedules.length) {
        await db.AddNewSchedules(schedules);
    }
    if (reply.length) {
        try {
            await ctxs[0].replyWithHTML(reply);
        } catch (e) {
            console.error(e);
        }
    }
}

async function ServiceCommand (ctx, db) {
    let chatID = FormatChatId(ctx.chat.id)
    let msgText = ctx.message.text
    if (msgText.indexOf('/list') == 0) {
        let tz = await db.GetUserTZ(ctx.from.id);
        await ctx.replyWithHTML(await LoadSchedulesList(chatID, tz, db));
    } else if (msgText.indexOf('/del') == 0) {
        if (msgText.indexOf('all') > -1) {
            return ['all'];
        } else {
            let nums = msgText.match(/[0-9]+/g);
            let ranges = msgText.match(/[0-9]+-[0-9]+/g);
            for (let i in nums) {
                nums[i] = parseInt(nums[i], 10);
            }
            for (let i in ranges) {
                let range = ranges[i];
                let index = range.indexOf('-');
                let leftNum = +range.substring(0, index);
                let rightNum = +range.substring(index + 1);
                if (leftNum > rightNum) {
                    let t = leftNum;
                    leftNum = rightNum;
                    rightNum = t;
                }
                for (let j = leftNum; j <= rightNum && j - leftNum <= 10; j++) {
                    nums.push(j);
                }
            }
            if (nums != null) {
                nums = nums.filter((item, pos) => {
                    return nums.indexOf(item) == pos;
                });
                nums.sort((a, b) => a - b);
                if (!isNaN(nums[0])) {
                    return nums;
                }
            }
        }
    } else if (MiscFunctions.IsInteger(msgText[1])) {
        return [parseInt(msgText.substring(1, msgText.length))];
    }
    console.log(`Serviced Command`);
}
//#endregion

module.exports = {
    GetDeletingIDsIndex,
    FormatChatId,
    LoadSchedulesList,
    StartTimeZoneDetermination,
    CheckExpiredSchedules,
    HandleTextMessage,
    ServiceMsgs,
    ServiceCommand
}