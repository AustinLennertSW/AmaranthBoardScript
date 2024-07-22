// ==UserScript==
// @name         Amaranth Board Script
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Amaranth
// @match        https://qdevweb.skyward.com/Kanban/Board/Amaranth/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=skyward.com
// @grant        none
// ==/UserScript==

/* global $ */
(function() {
    'use strict';

    const devs = {
        Ski: {
            ID: 10331,
            Name: "Nick Sosinski",
            LightColor: "#FCDE89",
            DarkColor: "#9A7204"
        },
        Hans: {
            ID: 10225,
            Name: "Nick Hansen",
            LightColor: "#BC9EE6",
            DarkColor: "#532692"
        },
        Hietpas: {
            ID: 10240,
            Name: "Matt Hietpas",
            LightColor: "#00E5CA",
            DarkColor: "#004D44"
        },
        Pritzl: {
            ID: 10101,
            Name: "Matthew Pritzl",
            LightColor: "#56B550",
            DarkColor: "#435421"
        },
        Austin: {
            ID: 11166,
            Name: "Austin Lennert",
            LightColor: "#779ECB",
            DarkColor: "#22577A"
        },
        Spencer: {
            ID: 10120,
            Name: "Spencer Krause",
            LightColor: "#FF7F50",
            DarkColor: "#594A31"
        },
        Carson: {
            ID: 10882,
            Name: "Carson Crueger",
            LightColor: "#CD5755",
            DarkColor: "#CD5755"
        },
        Jason: {
            ID: 9471,
            Name: "Jason Galloway",
            LightColor: "Khaki",
            DarkColor: "#594A31"
        },
        MeganM: {
            ID: 10886,
            Name: "Megan Melville",
            LightColor: "#FFAC81",
            DarkColor: "#B33B00"
        }
    }

    const projectPoints = {
        'XS': 2,
        'S': 3,
        'M': 5,
        'L': 8,
        'XL': 13,
    };

    // Any not listed default to 1
    const columnPointValueMultiplier = {
        'Invalid': 0,
        'Merge': 0.5,
        'UrgentQATestingPending': 0.5,
        'QATestingPending': 0.5,
        'Cleanup': 0.5
    };

    const isOnBacklog = kanbanboard.base == undefined;

    addCustomStyles();

    if (isOnBacklog) {
        displayPointValues();
        kanbanboard.connection.on("refreshBacklog", () => { setTimeout(displayPointValues, 500); });
    }
    else  // On Regular Board
    {
        displayPointValuesOnGoal()  // This sets up a click event so it shouldn't need to be reran
        kanbanboard.base.addInit(displayPointValues); // Show point values whenever the board is loaded or refreshed
        kanbanboard.base.addInit(setAssignedData);
        kanbanboard.base.addInit(autoMarkPatch);
        kanbanboard.connection.on("moveCard", displayPointValues);
        kanbanboard.connection.on("moveCard", setAssignedData);
        kanbanboard.connection.on("updateprojectassignedto", setAssignedData);

    }

    const currentUserID = kanbanboard.staffID;
    switch (currentUserID)
    {
        case devs.Austin.ID:
            enlargeGoalModal()
            addOpenProjectControls();
            addSignalRMethodLogs();
            addCopyButtonsToPRModal();
            removeWIP();
            addMarkdownBlockRenderer();
            addMdBlockElementsHandler();
            break;

        case devs.Ski.ID:
            enlargeGoalModal()
            removeWIP();
            break;
    }

    function getTheme()
    {
        return document.documentElement.getAttribute('data-theme');
    }

    function getColor(dev)
    {
        const theme = getTheme();
        return theme == 'light'
            ? dev.LightColor
        : theme == 'dark'
            ? dev.DarkColor
        : null;
    }

    function addBox(boxID, text, insertBeforeSelector)
    {
        if ($(`#${boxID}`).length > 0)
        {
            $(`#${boxID}`).remove();
        }
        let newBox = $(`<span id="${boxID}">`);
        newBox.text(text);
        newBox.addClass("FlexBoxItem TeamInfoText")
        newBox.insertBefore($(insertBeforeSelector));
    }

    /** Displays project point values */
    function displayPointValues() {
        try {
            setTimeout(() => {
                let totals = {};
                $('.Project').each((index, project) => {
                    let item = $(project);
                    if (item.hasClass("CollaborationProject")) {
                        return;
                    }
                    let progressBarEstimate = item.find(".ProgressBar__estimate");
                    let originalProjectSizeContainer = item.find(".ProjectSize");
                    // IQs don't have progress bar or estimate, which is perfect since we want to ignore those
                    if (progressBarEstimate.length < 1 && originalProjectSizeContainer < 1) {
                        return true;
                    }
                    let projectSizeContainer = progressBarEstimate.length < 1 ? originalProjectSizeContainer : progressBarEstimate;
                    let projectSize = projectSizeContainer[0].innerText;
                    // Projects that go overestimate duplicate the progress bar to make the orange, this just gets the first one
                    if (projectSize == undefined) {
                        return true;
                    }
                    let container = $(item.closest("div.ColumnContainer")[0]);
                    let containerName = container.attr("id").replace("Container", '');
                    let basePointValue = projectPoints[projectSize];
                    if (basePointValue == undefined) {
                        return true;
                    }
                    let projectPointValue = basePointValue * (columnPointValueMultiplier[containerName] ?? 1);
                    if (containerName != "Backlog")
                    {
                        if (!(containerName in totals))
                        {
                            totals[containerName] = [];
                        }
                        totals[containerName].push(projectPointValue);
                    }
                    let progressBarEstimateText = `${projectSize} - ${projectPointValue}`;
                    if (projectPointValue != basePointValue)
                    {
                        progressBarEstimateText = progressBarEstimateText + `(${basePointValue})`;
                    }
                    projectSizeContainer.text(progressBarEstimateText);
                });


                let totalInProgressPoints = 0;
                for(const [columnName, val] of Object.entries(totals))
                {
                    let columnPointValue = val.reduce((a, b) => a+b, 0);
                    // Have to search for ids like this because some contain slashes which don't work when just searching by id
                    $(`div[id="${columnName}Container"] .WIPPoints`).remove();
                    $(`div[id="${columnName}Container"] .WIP`).append(`<span class='WIPPoints'>(${columnPointValue})</span;>`)
                    if (columnName != 'Closed')
                    {
                        totalInProgressPoints += columnPointValue;
                    }
                }
                if (totalInProgressPoints != 0)
                {
                    addBox('TotalRemainingPoints', `In Progress: ${totalInProgressPoints}`, 'span[title="Work in Progress"]');
                }
                if (totals['Closed'] && totals['Closed'].length > 0)
                {
                    addBox('ClosedCycle', `Closed: ${totals['Closed'].reduce((a, b) => a+b, 0)}`, 'span[title="Work in Progress"]');
                }
            }, 350);
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'displayPointValues' script:");
            console.error(error);
        }
    }

    /** Displays project point values and totals on the goal modal */
    function displayPointValuesOnGoal() {
        try {
            $(".menuItems #CycleGoal").click(() => {
                setTimeout(() => {
                    let goalPoints = 0;

                    // Loop through each project in goal
                    $("tbody .cycleGoal__projectSize").each(( _, row ) => {
                        let sizeElem = $(row);
                        let projectValue = projectPoints[sizeElem.text().trim()];
                        if (projectValue == undefined) {
                            return true;  // continue
                         }
                        row.append(`(${projectValue})`);
                        goalPoints += projectValue;
                    });

                    // Add "Total Point" section
                    $(".projectModalRow").append(`
                        <span>Total Points:</span>
                        <span id="CycleGoal_TotalPoints" class="cycleGoal__details">${goalPoints}</span>`
                    );
                }, 1000);
            });
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'displayPointValuesOnGoal' script:");
            console.error(error);
        }
    }

    /** Enlargens the Goal Modal when opened to be sized like most modals */
    function enlargeGoalModal() {
        try {
            $(".menuItems #CycleGoal").click(() => {
                setTimeout(() => {
                    $(".ModalPopup:has(.js-cycleGoal)").css({height: "90%", top: "5%"})
                }, 250);
            });
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'enlargeGoalModal' script:");
            console.error(error);
        }
    }

    /** Loops through each project and assigns the staff ID of the Assigned to person to `data-assignee-staff-i-d` attribute */
    function setAssignedData() {
        try {
            setTimeout(() => {
                $('.Project').each((_, project) => {  // TODO: Remove value when assigned to unknown
                    let item = $(project);

                    let assignedToDiv = item.find('.ProjectAssignedTo')[0];
                    let assignedToName = assignedToDiv.innerText;
                    let assignedToID = null;
                    for (const devKey of Object.keys(devs)) {
                        let dev = devs[devKey];
                        if (dev.Name != assignedToName) { continue }
                        assignedToID = dev.ID;
                        break;
                    }
                    item.attr('data-assignee-staff-i-d', assignedToID)
                });
            }, 50);  // TODO: Delay needed?
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'setAssignedData' script:");
            console.error(error);
        }
    }

    function setIndicators(projectID, indicatorIDs) {
        let formData = new FormData();
        formData.append('currentTeamID', 10358);
        formData.append('projectID', projectID);

        if (indicatorIDs && indicatorIDs.length > 0)
        {
            indicatorIDs.forEach((indicatorID) => formData.append('indicatorIDs[]', indicatorID));
        }
        fetch('https://qdevweb.skyward.com/Kanban/api/Indicator/SaveProjectIndicators', { method: "POST", body: formData });
    }

    function getIndicators(projectID) {
        let indicatorIDs = [];
        $(`[data-project-id='${projectID}']`).find(".project__indicator").each((indIndex, indicator) => {
            indicator = $(indicator)[0];
            if (!indicator.getAttribute("title").includes("From Parent #"))  // Cannot include an indicator that is auto given from a parent because it will have double indicator
            {
                let indicatorID = indicator.getAttribute("data-indicator-id");
                if (indicatorID != 0)
                {
                    indicatorIDs.push(indicatorID);
                }
            }
        });

        return indicatorIDs;
    }

    function removeIndicator(projectID, indicatorID) {
        let indicatorIDs = getIndicators(projectID);
        if (indicatorIDs.includes(indicatorID))
        {
            indicatorIDs.splice(indicatorIDs.indexOf(indicatorID), 1);
            setIndicators(projectID, indicatorIDs);
        }
    }

    function addIndicator(projectID, indicatorID) {
        let indicatorIDs = getIndicators(projectID);
        if (!indicatorIDs.includes(indicatorID))
        {
            indicatorIDs.push(indicatorID);
            setIndicators(projectID, indicatorIDs);
        }
    }

    /** Auto adds Patch indicator to projects not on a .0 release */
    function autoMarkPatch(){
        try {
            setTimeout(() => {
                $('.Project').each((index, project) => {
                    let item = $(project);
                    if (item.hasClass("CollaborationProject")) {
                        return;
                    }
                    let targetReleaseContainer = item.find(".TargetRelease");
                    if (targetReleaseContainer.length != 1) {
                        return
                    }
                    let targetReleaseText = targetReleaseContainer[0].innerText;
                    if (targetReleaseText)
                    {
                        let targetRelease = targetReleaseText.split(' ')[0];
                        let targetReleaseLastNumber = targetRelease.split('.')[2];
                        if (targetReleaseLastNumber != '0')
                        {
                            addIndicator(item[0].getAttribute("data-project-id"), "17");
                        }
                    }
                });
            }, 1000);
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'autoMarkPatch' script:");
            console.error(error);
        }
    }

    /**
     * Removes the WIP box from the header
     */
    function removeWIP()
    {
        try {
            $("span[title=\"Work in Progress\"]").contents().remove();
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'removeWIP' script:");
            console.error(error);
        }
    }

    function addCopyButtonsToPRModal() {
        try {
            function generateCopyElement(copyValue, size=16) {return $.parseHTML(
                `<span><clipboard-copy aria-label="Copy" data-copy-feedback="Copied!" value="${copyValue}" data-view-component="true" class="Link--onHover ml-1" tabindex="0" role="button">
                    <svg aria-hidden="true" fill="var(--primary-color)" height="${size}" viewBox="0 0 16 16" version="1.1" width="${size}" data-view-component="true" class="copy">
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                    </svg>
                    <svg style="display: none;" fill="green" aria-hidden="true" height="${size}" viewBox="0 0 16 16" version="1.1" width="${size}" data-view-component="true" class="check">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                    </svg>
                </clipboard-copy></span>`);}

            function copy(text) {
                return navigator.clipboard.writeText(text);
            }

            function addCopyButtons() {
                let summary = $(".ModalPopup").last().find(".ModalProjectSummary");
                let copyIDButton = generateCopyElement(summary.attr("data-project-id"), 20);
                let copySummaryButton = generateCopyElement(summary.text(), 20);
                summary.prepend(copyIDButton[0]);
                summary.append(copySummaryButton[0]);
            }

            kanbanboard.projectDetailsModal.addInit(addCopyButtons);
            $(document).on("click", "clipboard-copy", (e) => { copy(e.currentTarget.getAttribute("value")); });
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'addCopyButtonsToPRModal' script:");
            console.error(error);
        }
    }

    /** Adds logging for Signal R methods for debugging */
    function addSignalRMethodLogs() {
        try {
            let methodNames =
                [
                    "addProjectCard",
                    "moveCard",
                    "notify",
                    "refreshBacklog",
                    "refreshBoard",
                    "removeIndicator",
                    "removeProjectCard",
                    "updateActionsRunning",
                    "updateBoardToNewSprint",
                    "updateHoldStatus",
                    "updateIndicator",
                    "updateIndicatorsForProject",
                    "updateIndicatorsForProjects",
                    "updateProjectAssignedTo",
                    "updateUserActionRunning"
                ];
            for(let methodName of methodNames) {
                kanbanboard.connection.on(methodName, () => console.log(`SignalR method triggered: ${methodName}`));
            }
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'addSignalRMethodLogs' script:");
            console.error(error);
        }
    }

    /**
     * Adds a control to the right of the header to open any PR on the board even if the project isn't on the board
     */
    function addOpenProjectControls() {
        try {
            const openProjectModal = () => kanbanboard.projectDetailsModal.create(Number.parseInt(projectIdTextInput.val()));
            const projectIdTextInput = $('<input>')
            .attr('id', 'projectid')
            .attr('name', 'projectid')
            .attr('type', 'text')
            .attr('placeholder', 'Project ID')
            .addClass('teamSelector boardNavigation__control')
            .css({
                cursor: 'text',
                padding: '5px 9px',
                'font-size': '16px',
                height: '33px',
                'box-sizing': 'border-box',
                width: '7em',
                'text-align': 'start',
            })
            .click(function () {
                $(this).select();
            })
            .keypress(function (event) {
                if (event.key === 'Enter') {
                    openProjectModal();
                }
            });

            const openButton = $('<button>')
            .addClass('TriggerRefine')
            .css({
                'border-radius': '5px 0 0 5px'
            })
            .text('Open')
            .click(openProjectModal);

            const pasteButton = $(`<button class="TriggerRefine"><svg id="Paste_24" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="24" height="24" stroke="none" fill="#000000" opacity="0"></rect><g transform="matrix(0.74 0 0 0.74 12 12)"><path style="stroke: none;stroke-width: 1;stroke-dasharray: none;stroke-linecap: butt;stroke-dashoffset: 0;stroke-linejoin: miter;stroke-miterlimit: 4;fill: var(--primary-color);fill-rule: nonzero;opacity: 1;" transform=" translate(-15, -13.5)" d="M 15 0 C 13.35499 0 12 1.3549904 12 3 L 8 3 C 6.3550302 3 5 4.3550302 5 6 L 5 24 C 5 25.64497 6.3550302 27 8 27 L 22 27 C 23.64497 27 25 25.64497 25 24 L 25 6 C 25 4.3550302 23.64497 3 22 3 L 18 3 C 18 1.3549904 16.64501 0 15 0 z M 15 2 C 15.564129 2 16 2.4358706 16 3 C 16 3.5641294 15.564129 4 15 4 C 14.435871 4 14 3.5641294 14 3 C 14 2.4358706 14.435871 2 15 2 z M 8 5 L 12 5 L 12 6 C 12 6.552 12.448 7 13 7 L 17 7 C 17.552 7 18 6.552 18 6 L 18 5 L 22 5 C 22.56503 5 23 5.4349698 23 6 L 23 24 C 23 24.56503 22.56503 25 22 25 L 8 25 C 7.4349698 25 7 24.56503 7 24 L 7 6 C 7 5.4349698 7.4349698 5 8 5 z" stroke-linecap="round"></path></g></svg></button>`)
            .css({
                'padding': '2px',
                'border-radius': '0 5px 5px 0px',
            })
            .click(() => {
                navigator.clipboard.readText().then(text => {
                    $("#projectid").val(text);
                    openProjectModal();
                });
            });

            const controlSpan = $('<span>')
            .addClass('FlexBoxItem TeamInfoText boardNavigation')
            .append(projectIdTextInput)
            .append(openButton)
            .append(pasteButton);

            controlSpan.appendTo('.menuItems');
        } catch (error) {
            console.error(
                "CUSTOM SCRIPT: There was a problem when running the 'addOpenProjectControls()' script function:"
            );
            console.error(error);
        }
    }

    /** Adds md-block elements where markdown would be nice */
    function addMdBlockElementsHandler() {
        const addMdBlockElements = () => {
            // Add md-block to project description
            let projectHrs = $(".ModalContent > .ProjectDescription > hr");
            // Isolate the contents between the last 2 headers, as the content here is the description
            $(projectHrs[1]).nextUntilWithTextNodes(projectHrs[2]).wrapAll("<div class='converttomdblock'>");
            let parsedDescription = $(".converttomdblock");
            let contents = parsedDescription[0].innerHTML;
            parsedDescription.contents().remove();
            parsedDescription.append(`<md-block>${contents}</md-block>`);

            // Add md-block to action notes
            $(".ModalPopup").last().find(".js-projectActions .js-actionContainer").each((_, action) =>{
                let actionNote = $(action).find(".ActionNotes > p");
                let textContent = actionNote.text();
                actionNote.contents().filter(function(){ return this.nodeType != 1; }).remove();  // Deletes text content
                actionNote.append(`<md-block>${textContent}</md-block>`);

            })
        }
        kanbanboard.projectDetailsModal.addInit(addMdBlockElements);
    }

    /** Sets up https://www.makeuseof.com/md-block-render-markdown-web-page/ to render md-block elements*/
    function addMarkdownBlockRenderer() {
        // Gets the js for the library and invokes it
        const mdBlockJSURL = "https://md-block.verou.me/md-block.js";
        fetch(mdBlockJSURL, { method: "GET" })
            .then((res) => {
            return res.text();
        })
            .then((text) => {
            let mdBlock = text.replaceAll("export ", "");
            eval(mdBlock);
        });
    }

    /** Adds custom styles */
    function addCustomStyles() {
        try {
            let devColors = "";
            let devStyles = "";
            let assigneeStyles = "";

            const addDevColor = (dev) => { devColors += `--devColor${dev.ID}: ${getColor(dev)}; `; }

            const addDevStyle = (dev) => { devStyles += `.Project[data-developer-staff-i-d="${dev.ID}"] { --devColorMain: var(--devColor${dev.ID}) } \n`; }

            const addAssigneeStyle = (dev) => { assigneeStyles += `.Project[data-assignee-staff-i-d="${dev.ID}"] { --devColorAssigned: var(--devColor${dev.ID}) } \n`; }

            for (const devKey of Object.keys(devs)) {
                let dev = devs[devKey];
                addDevColor(dev);
                addDevStyle(dev);
                addAssigneeStyle(dev);
            }

            // This assumes all DevIDs we care about have a '1' somewhere in them to avoid coloring backlogged projects
            $('head').append(`<style>
.Project {
    --devColorMain: var(--secondary-color-bg);
    --devColorAssigned: var(--secondary-color-bg);
}
.Project[data-developer-staff-i-d*='1'] {
    background: linear-gradient(var(--devColorMain), var(--devColorMain), var(--devColorAssigned));
}

.missing-dev {
    animation: blinkingBackground 4s infinite;
}

@keyframes blinkingBackground {
    0% { background-color: #ff0000; }
    50% { background-color: #ff9999; }
    100% { background-color: #ff0000; }
}

clipboard-copy {
    cursor: pointer;
}

clipboard-copy:hover svg {
    fill: #4493f8;
}

md-block > p {
    display: inline-block;
    width: 100%;
}

${devStyles}
${assigneeStyles}
html { ${devColors} }
</style>`);
        } catch (error) {
            console.error("CUSTOM SCRIPT: There was a problem when running the 'addCustomStyles' script:");
            console.error(error);
        }
    }
})();

/** Next until but includes text nodes as well */
$.fn.nextUntilWithTextNodes = function (until) {
    let matched = $.map(this, function (elem, i, until) {
        let matched = [];
        while ((elem = elem.nextSibling) && elem.nodeType !== 9) {
            if (elem.nodeType === 1 || elem.nodeType === 3) {
                if (until && jQuery(elem).is(until)) {
                    break;
                }
                matched.push(elem);
            }
        }
        return matched;
    }, until);

    return this.pushStack(matched);
};

console.log("Amaranth Board Script Loaded");
