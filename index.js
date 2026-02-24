const { VK } = require('vk-io');
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');
const Chat = require('./models/Chat');
const { hasRole } = require('./systems/roles');
const antispam = require('./systems/antispam');
const filter = require('./systems/filter');
const games = require('./systems/games');
const rp = require('./systems/rp');

mongoose.connect(config.mongo);

const vk = new VK({ token: config.token });

vk.updates.on("message_new", async (ctx) => {
    if (!ctx.text) return;

    if (antispam(ctx)) return;

    let user = await User.findOne({ id: ctx.senderId });
    if (!user) user = await User.create({ id: ctx.senderId });

    let chat = await Chat.findOne({ chatId: ctx.chatId });
    if (!chat) chat = await Chat.create({ chatId: ctx.chatId });

    if (filter(ctx.text, chat.filter)) {
        await ctx.deleteMessage(ctx.id);
        return ctx.send("🚫 Запрещённое слово.");
    }

    const args = ctx.text.split(" ");
    const cmd = args[0].toLowerCase();

    // ===== ИГРЫ =====
    if (cmd === "/roll") return games.roll(ctx);
    if (cmd === "/coin") return games.coin(ctx);

    // ===== RP =====
    if (cmd === "/hug" && ctx.replyMessage)
        return rp.hug(ctx, ctx.replyMessage.senderId);

    // ===== ВАРН =====
    if (cmd === "/warn") {
        if (!hasRole(user.role, "moderator"))
            return ctx.send("⛔ Недостаточно прав");

        const targetId = ctx.replyMessage?.senderId;
        if (!targetId) return ctx.send("Ответьте на сообщение");

        const target = await User.findOne({ id: targetId });
        target.warns++;
        target.warnHistory.push(`Выдан варн ${new Date().toLocaleString()}`);
        await target.save();

        return ctx.send("⚠ Предупреждение выдано");
    }

    // ===== МУТ =====
    if (cmd === "/mute") {
        if (!hasRole(user.role, "moderator"))
            return ctx.send("⛔ Нет прав");

        const targetId = ctx.replyMessage?.senderId;
        const minutes = Number(args[1]) || 10;

        const target = await User.findOne({ id: targetId });
        target.muteUntil = Date.now() + minutes * 60000;
        await target.save();

        return ctx.send(`🔇 Мут на ${minutes} минут`);
    }

    // ===== QUIET MODE =====
    if (cmd === "/quiet") {
        if (!hasRole(user.role, "admin"))
            return ctx.send("⛔ Нет прав");

        chat.quiet = !chat.quiet;
        await chat.save();

        return ctx.send(`🔕 Режим тишины: ${chat.quiet ? "Вкл" : "Выкл"}`);
    }

});

vk.updates.start().then(() => console.log("🚀 ARIZONA VYBE MANAGER"));