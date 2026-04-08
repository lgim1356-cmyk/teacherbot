const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const mongoose = require('mongoose');
const http = require('http'); //24시간 깨워두기

// 1. 토큰과 DB주소 가져오기

const token = process.env.DISCORD_TOKEN;
const mongodbUri = process.env.MONGODB_URI; 

const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

// 생존신고용 가짜서버
http.createServer((req, res) => {
    res.write("TeacherBot is running!");
    res.end();
}).listen(8080); 


// 2. 데이터베이스 연결
mongoose.connect(mongodbUri)
    .then(() => console.log('데이터베이스 연결 성공!'))
    .catch(err => console.error('연결 실패:', err));

// 2. 유저 데이터 설계도 
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    goal: { type: String, default: "설정 안 됨" },
    submitted: { type: Boolean, default: false },
    missCount: { type: Number, default: 0 },
    penaltyHomework: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// 주제 리스트 (원하는 대로 수정하세요!)
const topics = [
    "우주", "정장", "느와르", "드래곤", "퍼리", "판타지", "무협", 
    "음식", "자연", "액션", "CP연성", "제복", 
    "시간", "인외", "SF", "직업", "역사", "중년"
];

client.once(Events.ClientReady, () => {
    console.log(`선생님 봇이 출근했습니다! (단일 서버 모드)`);

    // [스케줄러 1] 매주 일요일 밤 23:59 정산
    cron.schedule('59 23 * * 0', async () => {
        try {
            const users = await User.find({});
            for (const user of users) {
                if (!user.submitted) {
                    user.missCount += 1;
                    user.penaltyHomework += 1;
                }
                user.submitted = false;
                await user.save();
            }
            console.log('주간 숙제 정산 완료!');
        } catch (err) {
            console.log('정산 오류', err);
        }
    });

});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // 1. 유저 정보 찾아오기
    let user = await User.findOne({ userId: userId });
    if (!user) {
        user = new User({ userId: userId });
        await user.save();
    }

    // [!목표]
    if (message.content.startsWith('!목표 ')) {
        user.goal = message.content.replace('!목표', '');
        await user.save();
        message.reply(`🎯 목표 설정 완료: **${user.goal}**`);
    }

    // [!제출]
    if (message.content === '!제출') {
        if (!user.submitted) user.totalCount += 1;
        user.submitted = true;
        await user.save();
        message.reply('✅ 이번 주 숙제 제출 완료!');
    }

    // [!현황]
    if (message.content === '!현황') {
        const status = user.submitted ? "제출 완료 ✅" : "미제출 ❌";
        const statusEmbed = new EmbedBuilder()
            .setColor(76e665) // 녹색
            .setTitle(`📝 ${message.author.username}님의 현황판`)
            .addFields(
                { name: '🎯 나의 목표', value: user.goal, inline: true },
                { name: '📊 제출 상태', value: status, inline: true },
                { name: '🏆 누적 제출', value: `${user.totalCount || 0}회`, inline: false },
                { name: '⛔ 이번 달 미제출', value: `${user.missCount}회`, inline: false },
                { name: '❗ 추가 숙제', value: `${user.penaltyHomework}개`, inline: false }
            )

        message.reply({ embeds: [statusEmbed] }); // s 붙였습니다!
    }

    // [주제!]
    if (message.content === '!주제') {
    // 1. 리스트를 무작위로 섞기
    const shuffled = [...topics].sort(() => 0.5 - Math.random());
    
    // 2. 앞에서 3개만 쏙 골라내기
    const selected = shuffled.slice(0, 3);
    
    const topicEmbed = new EmbedBuilder()
        .setColor(0x1E90FF) // 우주 느낌의 진한 파란색 (DodgerBlue)
        .setTitle('💬 선생님의 추천 키워드')
        .setDescription(`오늘은 이 **3가지 키워드**를 조합해서 그려보세요!\n\n✨ **${selected[0]} / ${selected[1]} / ${selected[2]}**`)
        .addFields({ 
            name: '💡 가이드', 
            value: '세 단어가 모두 들어간 하나의 장면을 그려도 좋고,\n가장 마음에 드는 단어 하나만 골라 집중해도 좋습니다!' 
        })

    message.reply({ embeds: [topicEmbed] });
    }
});

client.login(token);