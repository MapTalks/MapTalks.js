const data = require('../../data');

const style = [
    {
        type: 'text',
        dataConfig: {
            type: 'point'
        },
        sceneConfig: {
            collision: false
        },
        style: [
            {
                symbol: {
                    textName : 'A',
                    // textSize : 24,
                    textSpacing : 20,
                    textPlacement : 'line'
                }
            }
        ]
    }
];

module.exports = {
    style,
    data : data.line
};
