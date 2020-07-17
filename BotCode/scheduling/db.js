const { Pool } = require('pg');
class dbManagment {
    constructor(options) {
        this.pool = new Pool(options);
        this.sending = false;
        this.waitingForServiceMsgs = [];
    }

    async Query(query) {
        const client = await this.pool.connect();
        let res;
        try {
            res = await client.query(query);
        } catch (err) {
            console.error(err.stack);
        } finally {
            client.release();
            return res;
        }
    }

    async InitDB() {
        await this.Query('CREATE TABLE IF NOT EXISTS ChatIDs (ChatID TEXT)');
        await this.Query('CREATE TABLE IF NOT EXISTS Schedules (ChatID TEXT, id INTEGER, text TEXT, ts BIGINT, username TEXT)');
        console.log(`Initialization finished`);
    }

    async AddNewSchedules(newSchedules) {
        let queryString = `INSERT INTO Schedules VALUES `;
        let id;
        let schedules = await this.GetSchedules(newSchedules[0].chatID);
        if (schedules === false) id = 1;
        else id = schedules.length + 1;
        if (!(await this.HasChatID(newSchedules[0].chatID))) {
            await this.Query(`INSERT INTO ChatIDs VALUES ('${newSchedules[0].chatID}')`);
            console.log(`Added chat "${newSchedules[0].chatID}" to ChatIDs`);
        }
        for (let schedule of newSchedules) {
            if (schedule.chatID[0] != '_' || typeof (schedule.username) == 'undefined') schedule.username = 'none';
            queryString += `('${schedule.chatID}', ${id}, '${schedule.text}', ${schedule.timestamp}, '${schedule.username}'), `;
            id++;
        }
        queryString = queryString.substring(0, queryString.length - 2);
        let res = await this.Query(queryString);
        console.log(`Added multiple schedules = ${JSON.stringify(newSchedules)}`);
    }

    async AddNewSchedule(chatID, text, timestamp, username) {
        if (chatID[0] != '_' || typeof (username) == 'undefined') username = 'none';
        let id;
        let schedules = await this.GetSchedules(chatID);
        if (schedules === false) id = 1;
        else id = schedules.length + 1;
        if (typeof (id) == 'undefined') id = 1;
        console.log(`Timestamp = ${timestamp}`);
        if (!(await this.HasChatID(chatID))) {
            await this.Query(`INSERT INTO ChatIDs VALUES ('${chatID}')`);
            console.log(`Added chat "${chatID}" to ChatIDs`);
        }
        await this.Query(`INSERT INTO Schedules VALUES ('${chatID}', ${id}, '${text}', ${timestamp}, '${username}')`);
        console.log(`Added "${text}" to ${timestamp} from chat "${chatID}"`);
    }

    async RemoveSchedules(chatID, s) {
        console.log(`Removing schedule s = ${"s"}\r\ChatID = "${chatID}" typeof(ChatID) = ${typeof (chatID)}`);
        let query = `DELETE FROM Schedules WHERE ChatID = '${chatID}' AND (${s})`;
        console.log(`QUERY = "${query}"`);
        let res = await this.Query(query);
        console.log(`res = ${JSON.stringify(res.rows)}`);
    }

    async ClearAllSchedules(chatID) {
        console.log(`Clearing all schedules in chat ${chatID}`);
        await this.Query(`DELETE FROM Schedules WHERE ChatID = '${chatID}'`);
        console.log(`Cleared all schedules`);
    }

    async ReorderSchedules(chatID) {
        let schedules = await this.GetSchedules(chatID);
        if (schedules !== false) {
            await this.Query(`DELETE FROM Schedules WHERE id >= 0 AND ChatID = '${chatID}'`);
            let i;
            let queryString = `INSERT INTO Schedules VALUES `;
            for (i in schedules) {
                let schedule = schedules[i];
                i = +i;
                queryString += `('${chatID}', ${i + 1}, '${schedule.text}', ${schedule.ts}, '${schedule.username}'), `;
                console.log(`Reordering schedule with new id = ${i + 1}`);
            }
            queryString = queryString.substring(0, queryString.length - 2);
            console.log(`queryString = ${queryString}`);
            let res = await this.Query(queryString);
            return true;
        } else return false;
    }

    async ListSchedules(chatID) {
        if (!this.sending) {
            let schedules = await this.GetSchedules(chatID);
            if (schedules.length) {
                return schedules;
            }
        }
        return false;
    }

    async CheckActiveSchedules(tsNow) {
        let expiredSchedules = [];
        let ChatIDs = await this.Query(`SELECT * FROM ChatIDs`);
        for (let chatID of ChatIDs.rows) {
            let schedules = await this.GetSchedules(chatID.chatid);
            if (schedules !== false) {
                for (let schedule of schedules) {
                    console.log(`schedule = ${JSON.stringify(schedule)}, tsNow = ${tsNow}`);
                    if (schedule.ts <= tsNow) {
                        expiredSchedules.push(schedule);
                    }
                }
            }
        }
        return expiredSchedules;
    }

    async GetChatIDs() {
        let res = await this.Query(`SELECT * FROM ChatIDs`);
        console.log(`Picked chatIDs ${JSON.stringify(res.rows)}`);
        if (res.rows.length > 0) return res.rows;
        return false;
    }

    async GetScheduleByText(chatID, text) {
        let res = await this.Query(`SELECT * FROM Schedules WHERE text = '${text}' AND ChatID = '${chatID}'`);
        console.log(`Picked schedule by text ${JSON.stringify(res.rows)}`);
        if (res.rows.length > 0) return res.rows[0].ts;
        else return false;
    }

    async GetScheduleById(chatID, id) {
        let res = await this.Query(`SELECT * FROM Schedules WHERE id = '${id}' AND ChatID = '${chatID}'`);
        console.log(`Picked schedule by id ${JSON.stringify(res.rows)}`);
        if (res.rows.length > 0) return res.rows[0].ts;
        else return false;
    }

    async GetSchedules(chatID) {
        let res = await this.Query(`SELECT * FROM Schedules WHERE ChatID = '${chatID}'`);
        console.log(`Picked schedules ${JSON.stringify(res.rows)}`);
        if (res.rows.length > 0) return res.rows;
        else return false;
    }

    async HasChatID(chatID) {
        let res = await this.Query(`SELECT * FROM ChatIDs WHERE ChatID = '${chatID}'`);
        if (res.rows.length > 0) return true;
        else return false;
    }
}

module.exports = { dbManagment };