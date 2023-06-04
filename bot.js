const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;
const readline = require('readline');
const fs = require('fs');
const config = require('./settings.json');

const loggers = require('./logging.js');
const logger = loggers.logger;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
let bot;

function createBot() {
    const bot = mineflayer.createBot({
        username: config['bot-account']['username'],
        password: config['bot-account']['password'],
        auth: config['bot-account']['type'],
        host: config.server.ip,
        port: config.server.port,
        version: config.server.version,
    });

    rl.on('line', (input) => {
        // Check if the input is a command starting with '/'
        if (input.startsWith('/')) {
            // Remove the '/' from the command
            const command = input;
            bot.chat(command); // Send the command to the server
            logger.info(`Sent command: ${command}`);

        } else if (input.startsWith('!')) {

            // Implement your command handling logic here
            // You can use conditional statements or a switch case to handle different commands

            // Example command: "move x y z"
            if (input.startsWith('!move')) {
                const args = input.split(' ');
                if (args.length === 4) {
                    const x = parseFloat(args[1]);
                    const y = parseFloat(args[2]);
                    const z = parseFloat(args[3]);

                    bot.pathfinder.setGoal(new GoalBlock(x, y, z));
                    logger.info(`Moving to target location (${x}, ${y}, ${z})`);

                    // Log when the bot is stuck
                    bot.on('path_update', (r) => {
                        const nodesPerTick = (r.visitedNodes * 50).toFixed(2);
                        logger.info(`I can't get there. Stuck after ${r.time}ms. Visited ${r.visitedNodes} nodes (${nodesPerTick}/s)`);
                    });

                    // Log when the pathfinder is done
                    bot.on('goal_reached', () => {
                        logger.info('I\'m here!');
                    });
                    return;
                }
            }

            // Example command: "stop"
            if (input === '!stop') {
                bot.pathfinder.setGoal(null);
                logger.info('Stopped moving');
                return;
            }

            // Add more commands as needed
            // right click when empty hand
            if (input === '!join') {
                bot.activateEntity(bot.nearestEntity(e => e.type === 'player'));
            }

            // check current position
            if (input === '!pos') {
                logger.info(`Current position: ${bot.entity.position}`);
            }

            // Shift one time
            if (input === '!shift') {
                bot.setControlState('sneak', true);
                setTimeout(() => {
                    bot.setControlState('sneak', false);
                }, 500);
            }

            // Jump one time
            if (input === '!jump') {
                bot.setControlState('jump', true);
                setTimeout(() => {
                    bot.setControlState('jump', false);
                }, 500);
            }

            // Fish Beta
            if (input === '!fish-beta') {
                bot.equip(bot.inventory.items().find(item => item.name.includes('rod')), 'hand');
                bot.fish();
            }

            // Fish
            if (input === '!fish') {
                bot.setQuickBarSlot(1);
                bot.activateItem();
            }

            // Select slot
            if (input.startsWith('!slot')) {
                const args = input.split(' ');
                if (args.length === 2) {
                    const slot = parseFloat(args[1]);
                    bot.setQuickBarSlot(slot);
                }
            }

        } else {
            // The input is not a command, handle it differently if needed
            logger.warn('Invalid command format');
        }
    });

    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.settings.colorsEnabled = false;
    bot.pathfinder.setMovements(defaultMove);

    bot.once('spawn', () => {
        logger.info("Bot joined to the server");

        if (config.utils['auto-auth'].enabled) {
            logger.info('Started auto-auth module');

            let password = config.utils['auto-auth'].password;
            setTimeout(() => {
                bot.chat(`/register ${password} ${password}`);
                bot.chat(`/login ${password}`);
            }, 500);

            logger.info(`Authentication commands executed`);
        }

        if (config.utils['chat-messages'].enabled) {
            logger.info('Started chat-messages module');

            let messages = config.utils['chat-messages']['messages'];

            if (config.utils['chat-messages'].repeat) {
                let delay = config.utils['chat-messages']['repeat-delay'];
                let i = 0;

                setInterval(() => {
                    bot.chat(`${messages[i]}`);

                    if (i + 1 === messages.length) {
                        i = 0;
                    } else i++;
                }, delay * 1000);
            } else {
                messages.forEach((msg) => {
                    bot.chat(msg);
                });
            }
        }

        const pos = config.position;

        if (config.position.enabled) {
            logger.info(
                `Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`
            );
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        }

        if (config.utils['anti-afk'].enabled) {
            if (config.utils['anti-afk'].sneak) {
                bot.setControlState('sneak', true);
            }

            if (config.utils['anti-afk'].jump) {
                bot.setControlState('jump', true);
            }

            if (config.utils['anti-afk']['hit'].enabled) {
                let delay = config.utils['anti-afk']['hit']['delay'];
                let attackMobs = config.utils['anti-afk']['hit']['attack-mobs']

                setInterval(() => {
                    if (attackMobs) {
                        let entity = bot.nearestEntity(e => e.type !== 'object' && e.type !== 'player'
                            && e.type !== 'global' && e.type !== 'orb' && e.type !== 'other');

                        if (entity) {
                            bot.attack(entity);
                            return
                        }
                    }

                    bot.swingArm("right", true);
                }, delay);
            }

            if (config.utils['anti-afk'].rotate) {
                setInterval(() => {
                    bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
                }, 100);
            }

            if (config.utils['anti-afk']['circle-walk'].enabled) {
                let radius = config.utils['anti-afk']['circle-walk']['radius']
                circleWalk(bot, radius);
            }
        }
    });

    bot.on('chat', (username, message) => {
        logger.info(`<${username}> ${message}`);
    });



    // Log everything in server
    bot.on('message', (message) => {
        logger.info(message.toAnsi());
    });

    bot.on('goal_reached', () => {
        if (config.position.enabled) {
            logger.info(
                `Bot arrived to target location. ${bot.entity.position}`
            );
        }
    });

    bot.on('death', () => {
        logger.warn(
            `Bot has been died and was respawned at ${bot.entity.position}`
        );
    });

    if (config.utils['auto-reconnect']) {
        bot.on('end', () => {
            setTimeout(() => {
                createBot();
            }, config.utils['auto-reconnect-delay']);
        });
    }

    bot.on('kicked', (reason) => {
        let reasonText = JSON.parse(reason).text;
        if (reasonText === '') {
            reasonText = JSON.parse(reason).extra[0].text
        }
        reasonText = reasonText.replace(/§./g, '');

        logger.warn(`Bot was kicked from the server. Reason: ${reasonText}`)
    }
    );

    bot.on('error', (err) =>
        logger.error(`${err.message}`)
    );



}


function circleWalk(bot, radius) {
    // Make bot walk in square with center in bot's  wthout stopping
    return new Promise(() => {
        const pos = bot.entity.position;
        const x = pos.x;
        const y = pos.y;
        const z = pos.z;

        const points = [
            [x + radius, y, z],
            [x, y, z + radius],
            [x - radius, y, z],
            [x, y, z - radius],
        ];

        let i = 0;
        setInterval(() => {
            if (i === points.length) i = 0;
            bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
            i++;
        }, 1000);
    });
}

function handleCommand(input) {

}
createBot();
