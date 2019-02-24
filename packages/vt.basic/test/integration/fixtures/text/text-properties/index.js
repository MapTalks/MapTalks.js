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
                    textName : '{name}'
                }
            }
        ]
    }
];

module.exports = {
    style,
    data : {
        type : 'FeatureCollection',
        features : [
            { type : 'Feature', geometry : { type : 'Point', coordinates : [0.5, 0.5] }, properties : { name : '茕茕' }}
        ]
    }
};
