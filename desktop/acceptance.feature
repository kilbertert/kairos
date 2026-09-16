# Acceptance contract for the Windows desktop shell.
#
# Scenarios assert observable outcomes for the person using the app. "The app
# stores a row in IndexedDB" is not an acceptable Then clause on its own; the
# observable form is "the data is still there after a restart".
#
# Executed by: desktop/tests/shell.spec.js (automated, CI, against
# dist-desktop/) and desktop/qa-plan.md (manual, Windows, for the capabilities
# a headless browser cannot exercise). The web application's behaviour is
# covered by the existing suite in tests/, which this change does not disturb.

Feature: Kairos as a Windows desktop application

  The web app is a local-first PWA. Someone who uses it daily wants it to be an
  application rather than a browser tab: a taskbar icon, a tray it lives in,
  system notifications when a focus session ends, and a keyboard shortcut that
  works while another application has focus. Those four capabilities are the
  entire reason the shell exists; everything else about the app must behave
  exactly as it does on the web.

  Rule: The shell does not change the application

    Scenario: The desktop build is the web build without a service worker
      Given the desktop frontend has been assembled
      When the assembled output is inspected
      Then every file from the web build is present
      And sw.js is not present

    Scenario: The app runs with no service worker registered
      Given the desktop frontend is served from a local origin
      When the app is opened
      Then the app becomes visible
      And no service worker is registered
      And no request to /sw.js is made

  Rule: Data is local, private, and survives a restart

    Scenario: Tasks persist across restarts
      Given the desktop app has been started
      When a project and a task are created
      And the app is restarted
      Then the project and task are still visible

    Scenario: The app contacts no external service
      Given the desktop app has been started
      When the app is used normally
      Then the only requests made are to the shell's own origin

  Rule: A completed focus session is announced outside the app

    Scenario: A finished focus session raises a system notification
      Given notification permission has been granted
      When a focus session completes
      Then a system notification appears naming Kairos, not another application
      And activating the notification brings the app to the foreground

    Scenario: A permission granted after startup is still honoured
      Given the app has started and notification permission is not yet granted
      When the person grants notification permission
      And a focus session completes
      Then a system notification appears

  Rule: The shell is what keeps the app alive

    Scenario: Closing the window does not quit the app
      Given the app is running with its window open
      When the window is closed
      Then the tray icon remains
      And the app is still running

    Scenario: The tray restores the window
      Given the app is running with its window hidden
      When the tray icon is activated
      Then the window becomes visible and focused

    Scenario: Quitting from the tray exits
      Given the app is running
      When Quit is chosen from the tray menu
      Then the process exits
      And the tray icon is gone

  Rule: The app is available without being the foreground application

    Scenario: A global shortcut controls the timer from another application
      Given the app is running
      And another application has focus
      When the global shortcut is pressed
      Then the focus timer starts or pauses
      And the notification sound is not suppressed by another application's mute

    Scenario: A shortcut already taken by another application is reported
      Given another running application has claimed the configured shortcut
      When the desktop app starts
      Then the failure is reported rather than silently ignored
      And the rest of the application still works

  Rule: The app survives being installed and updated

    Scenario: Installing for a single user does not require administrator rights
      Given a user without administrator rights
      When the installer is run
      Then the app installs
      And no elevation prompt is shown

    Scenario: Updating preserves local data
      Given the app is installed with existing projects, tasks and focus records
      When a newer version is installed over it
      Then the projects, tasks and focus records are unchanged
