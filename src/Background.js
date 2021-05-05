class Background
{
    start()
    {
        console.log("background");

        console.log(chrome.tabs);
        chrome.tabs.onUpdated.addListener(this.tabChanged.bind(this));
    }

    tabChanged(tabId, changeInfo, tab)
    {
        console.log(`tabId:${tabId} changeInfo:${changeInfo} tab:${tab}`);

        // read changeInfo data and do something with it
        // like send the new url to contentscripts.js
        if (changeInfo.url) {
            chrome.tabs.sendMessage( tabId, {
                message: 'hello!',
                url: changeInfo.url
            })
        }
    }
}

let bkg = new Background();
bkg.start();
