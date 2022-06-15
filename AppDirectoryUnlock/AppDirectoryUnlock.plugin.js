/**
 * @name AppDirectoryUnlock
 * @description Unlocks the App Directory with the use of Top.gg APIs
 * @author FedeIlLeone
 * @authorId 403195964241739776
 * @version 0.0.1
 * @updateUrl
 * @website
 * @source
 */

/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

module.exports = (() => {
    const config = {"info":{"name":"App Directory Unlock","authors":[{"name":"FedeIlLeone","discord_id":"403195964241739776","github_username":"FedeIlLeone"}],"version":"0.0.1","description":"Unlocks the App Directory with the use of Top.gg APIs","github":"","github_raw":""},"changelog":[{"title":"First Release","items":["First release of the plugin!"]}],"main":"index.js"};

    return !global.ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
	const {
		DiscordModules: { Dispatcher },
		Patcher,
		WebpackModules
	} = Library;

	const module = WebpackModules.getByProps("getCollections");
	const { getUserProfile } = WebpackModules.getByProps("getUserProfile");
	const { fetchProfile } = WebpackModules.getByProps("fetchProfile");
	const { fetchAuthorization } = WebpackModules.getByProps("fetchAuthorization");
	const ApplicationDirectoryProfile = WebpackModules.find(
		(m) => m?.default?.displayName === "ApplicationDirectoryProfile"
	);

	const cache = {
		apps: new Map(),
		search: new Map()
	};
	let isFetching = false;

	return class AppDirectory extends Plugin {
		onStart() {
			this.patchCategories();
			this.patchCollections();
			this.patchSimilarApplications();
			this.patchSearch();

			Patcher.before(ApplicationDirectoryProfile, "default", async (_, [props]) => {
				Dispatcher.wait(async () => {
					const fetchedApp = await this.fetchApp(props.application);
					isFetching = false;
					if (fetchedApp) {
						props.application = fetchedApp;
						props.application.directory_entry = {
							carousel_items: [],
							detailed_description: "",
							external_urls: [],
							supported_locales: []
						};
					}

					return props;
				});
			});

			Patcher.after(WebpackModules.getByProps("useApplicationIconSrc"), "useApplicationIconSrc", (_, [app]) => {
				if (app.iconUrl) return app.iconUrl;
			});
		}

		async fetchApp(app) {
			if (isFetching) return null;
			isFetching = true;

			if (cache.apps.has(app.id)) return cache.apps.get(app.id);

			const fetchedApp = await fetchAuthorization({
				clientId: app.id,
				scopes: []
			}).catch((res) => !res.ok || {});
			if (fetchedApp.application) {
				cache.apps.set(app.id, fetchedApp.application);
				return fetchedApp.application;
			}

			const fetchedUser = (await getUserProfile(app.id)) || (await fetchProfile(app.id));
			if (!fetchedUser.application) return null;

			const fetchedFixApp = await fetchAuthorization({
				clientId: fetchedUser.application.id,
				scopes: []
			}).catch(() => ({}));
			if (fetchedFixApp.application) {
				cache.apps.set(app.id, fetchedFixApp.application);
				return fetchedFixApp.application;
			}

			return null;
		}

		patchCategories() {
			Patcher.instead(module, "getCategories", () => [
				{ id: 1, name: "Productivity" },
				{ id: 2, name: "Creative" },
				{ id: 3, name: "Social" },
				{ id: 4, name: "Education" },
				{ id: 5, name: "Science & Tech" },
				{ id: 6, name: "Entertainment" },
				{ id: 7, name: "Music" },
				{ id: 8, name: "Gaming" },
				{ id: 9, name: "Fun" },
				{ id: 10, name: "Admin" }
			]);
		}

		patchCollections() {
			Patcher.instead(module, "getCollections", async () => {
				const topVotedResults = await fetch(
					"https://top.gg/api/client/entities/search?platform=discord&entityType=bot&amount=5&newSortingOrder=TOP_VOTED&query=&sort=top"
				).then((res) => res.json());
				const topVotedApplications = topVotedResults.results;
				topVotedApplications.map((app) => cache.search.set(app.id, app));

				const totalUsersResults = await fetch(
					"https://top.gg/api/client/entities/search?platform=discord&entityType=bot&amount=5&newSortingOrder=TOTAL_USERS&query=&sort=top"
				).then((res) => res.json());
				const totalUsersApplications = totalUsersResults.results;
				totalUsersApplications.map((app) => cache.search.set(app.id, app));

				return [
					{
						id: 1,
						position: 1,
						type: 1,
						title: "Top Voted Bots",
						application_directory_collection_items: topVotedApplications.map((app) => ({
							id: topVotedApplications.indexOf(app),
							type: 1,
							application: app
						}))
					},
					{
						id: 2,
						position: 2,
						type: 1,
						title: "Top Bots",
						application_directory_collection_items: totalUsersApplications.map((app) => ({
							id: totalUsersApplications.indexOf(app),
							type: 1,
							application: app
						}))
					}
				];
			});
		}

		patchSimilarApplications() {
			Patcher.instead(module, "getSimilarApplications", async (_, [appId]) => {
				const app = cache.search.get(appId);
				if (!app?.tags) return {};

				const randomTag = app.tags[Math.floor(Math.random() * app.tags.length)];
				const results = await fetch(
					`https://top.gg/api/client/entities/search?platform=discord&entityType=bot&skip=0&amount=4&query=&tags=${randomTag.slug}&categorySlot=more-like-this`
				).then((res) => res.json());

				const applications = results.results.filter((app) => app.id !== appId);
				applications.map((app) => cache.search.set(app.id, app));

				return {
					applications: applications
				};
			});
		}

		patchSearch() {
			Patcher.instead(module, "searchApplications", async (_, [query, , page]) => {
				const pageSkip = Math.max(7 * ((page?.page || 0) - 1), 0);
				const results = await fetch(
					`https://top.gg/api/client/entities/search?platform=discord&entityType=bot&amount=7&skip=${pageSkip}&nsfwLevel=1&newSortingOrder=TEXT_RELEVANCY&query=${query}&sort=top&isMature=false`
				).then((res) => res.json());

				const applications = results.results;
				applications.map((app) => cache.search.set(app.id, app));

				return {
					totalCount: results.stats["discord:bot"].count,
					totalPages: Math.ceil(results.stats["discord:bot"].count / 7),
					applications: applications
				};
			});
		}

		onStop() {
			Patcher.unpatchAll();
		}
	};
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/