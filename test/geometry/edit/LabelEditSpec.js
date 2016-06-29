
describe('#LabelEdit', function () {
    var container, eventContainer;
    var map;
    var center = new Z.Coordinate(118.846825, 32.046534);
    var layer;
    function getLabel() {
        var label = new maptalks.Label('I am a Text', map.getCenter()).addTo(layer);
        var symbol = label.defaultSymbol;
        label.setSymbol(symbol);
        return label;
    }

    beforeEach(function() {
        var setups = commonSetupMap(center, null);
        container = setups.container;
        map = setups.map;
        map.config('panAnimation', false);
        eventContainer = map._panels.canvasContainer;
        layer = new Z.VectorLayer('id');
        map.addLayer(layer);
    });

    afterEach(function() {
        removeContainer(container)
    });

    describe('edit label', function() {
        it('edit content',function() {
            var label = getLabel();
            label.on('edittextstart', startEdit);
            label.on('edittextend', endEdit);
            label.startEditText();
            expect(label.isEditingText()).to.be.ok;
            function startEdit(param) {
                var dom = label.getEditor();
                Z.DomUtil.on(dom, 'keyup', function(ev){
                    var oEvent = ev || event;
                    var char = String.fromCharCode(oEvent.keyCode);
                    if(oEvent.shiftKey) {
                        if(char == '1') {
                            char = '!';
                        }
                    }
                    dom.innerText += char;
                });
                happen.keyup(dom, {
                    shiftKey: true,
                    keyCode: 49
                });
                label.endEditText();
                expect(label.isEditingText()).to.not.be.ok;
            }
            function endEdit(param) {
                expect(label.getContent()).to.eql('I am a Text!');
            }
        });

        it('edit content with “Enter” key',function() {
            var label = getLabel();
            var size = label.getSize();
            label.on('edittextstart', startEdit);
            label.on('edittextend', endEdit);
            label.startEditText();
            expect(label.isEditingText()).to.be.ok;
            function startEdit(param) {
                var dom = label.getEditor();
                Z.DomUtil.on(dom, 'keyup', function(ev){
                    var oEvent = ev || event;
                    if(oEvent.keyCode === 13) {
                        dom.innerText += '\n';
                    }
                });
                happen.keyup(dom, {
                    keyCode: 13
                });
                label.endEditText();
                expect(label.isEditingText()).to.not.be.ok;
            }
            function endEdit(param) {
                var symbol = label.getSymbol();
                var textSize = symbol['textSize']||12;
                var spacing = symbol['textLineSpacing']||0;
                expect(label.getSize()['height']).to.eql(size['height']+textSize+spacing);
            }
        });

    });

});
