import { Chip, WikiCite, WikiSection, WikiSub, WikiTable } from "../wiki";
import { P, WikiGallery, WikiNote, WikiSteps, WikiThumb, Xref } from "../wikiMedia";

const FORMS = [
  ["Original", "The pet's first face: a theme-accent slime blob."],
  ["Rimuru", "TenSura's Rimuru Tempest: a salaryman reborn as a slime."],
  ["Glaucira", "Stands in for Veldora, the Storm Dragon."],
  ["Crimson Blossom", "Stands in for Benimaru, the kijin general."],
  ["Sion", "Stands in for Shion, the demon secretary."],
  ["Wangcai", "Stands in for Ranga, the Tempest Wolf."],
  ["Yinyue Fox", "Stands in for Shuna, the gentle priestess."],
  ["Kabi", "Stands in for Gobta, with an apple habit."],
  ["Ciel", "The personified Great Sage, Rimuru's ultimate intelligence skill."],
  ["Gojo", "Jujutsu Kaisen's Gojo Satoru, the strongest sorcerer."],
  ["Mashiro Rima", "Stands in for Milim Nava, now a stage idol."],
] as const;

const TREASURES = [
  ["Golden Coin", "Login", "bottom-left of the page"],
  ["Cassette", "Repository", "right edge of the page"],
  ["Glowing Orb", "Repository", "top-right of the page"],
  ["Game Cartridge", "Upload", "lower right of the page"],
  ["Star Shard", "My Library", "lower left of the page"],
  ["Golden Key", "Arena", "left edge of the page"],
] as const;

export function PetPage() {
  return (
      <WikiSection id="pet" title="The pixel pet and the scavenger hunt">
        <WikiThumb id="pet-idle" width={360} />
        <P>
          The pet is a clipper-style companion at the bottom right. It explains the interface, runs a
          scavenger hunt, hands out achievements, and becomes a help library once the hunt is complete.
          It is draggable, remembers where you left it and can be switched off in Settings → Preferences.
          It speaks in two voices: an English line and a Japanese line, which always carries its translation.
        </P>
        <WikiTable
          headers={["Interaction", "What happens"]}
          rows={[
            ["Hover on a labeled control", "After a 2.5 second dwell (a progress ring fills) the pet explains the control. A three second cooldown follows."],
            ["Click", "Pets the pet and shows the next discovered tip; while treasures are missing, a hint for the next one is included."],
            ["Double-click", "Opens the pet menu: next tip, achievement rack, forms, size, docking presets and reset."],
            ["Drag", "Moves the pet anywhere in the window; the tooltip flips sides to stay on screen."],
            ["Drag a paper onto it", "A dashed ring marks the disposal boundary; dropping a saved paper removes it from your library, and the pet reacts in character."],
            ["Chat (after the hunt)", "Quick questions and a free-text ask, answered from the tip catalog."],
          ]}
        />
        <WikiGallery cols={3} ids={["pet-close", "pet-tip", "pet-menu"]} />

        <WikiSub id="pet-forms" title="The eleven forms">
          <P>
            Each form plays its own sprite sheet (an 8 × 9 atlas of 192 × 208 frames, idle loop of the
            first six) at native resolution with hard pixels, and speaks in character: Gojo casts his
            domain, Kabi asks for apples, Ciel reports "calculation complete". The form is remembered per
            browser; while the chat is locked the pet and the logo use the Original form.
          </P>
          <WikiTable headers={["Form", "Lore"]} rows={FORMS.map(([name, lore]) => [<Chip key={name}>{name}</Chip>, lore])} />
        </WikiSub>

        <WikiSub id="pet-hunt" title="Treasures and achievements">
          <WikiThumb id="hunt-glint" width={170} />
          <P>
            Six treasures are hidden across the pages as faint glints; click one to collect it (each pays
            five sun). Finding all six completes the hunt: every tip becomes discovered (27 of 27) and the
            pet's chat library opens. The glints can be turned off in Almanac → Scene → Particles.
          </P>
          <WikiTable headers={["Treasure", "Page", "Where"]} rows={TREASURES.map(([n, pg, w]) => [<Chip key={n}>{n}</Chip>, pg, w])} />
          <P>
            Nine <Chip>achievements</Chip> reward exploring: First Contact, Tip Collector (5 tips), Tip Master
            (all 27), Treasure Hunter (1), Treasure Hoarder (3), Hunt Complete (6), Petting Zoo (10 pets),
            Traveler (drag the pet) and Question Master (3 help questions). Each pays sun too.
          </P>
        </WikiSub>
      </WikiSection>
  );
}

export function Customizing() {
  return (
      <WikiSection id="customizing" title="Customizing: themes, looks and settings">
        <WikiSub id="theme" title="Accent theme and dark mode">
          <WikiThumb id="theme-picker-popover" width={200} />
          <P>
            The palette button at the top right opens the theme popover: twelve accent palettes (Amber is
            the default; Coral, Violet, Sky, Mint, Rose, Mono, Copper, Indigo, Lime, Pink and Cyan) and a{" "}
            <Chip>Light</Chip> / <Chip>Dark</Chip> switch. The accent recolors the whole interface, including
            buttons, the pipeline bars and the graph. Without a stored choice the mode follows the
            operating system.
          </P>
        </WikiSub>

        <WikiSub id="settings" title="Settings">
          <WikiThumb id="settings" width={340} />
          <P>
            <Chip>Preferences</Chip> holds the site mode, the interface option to show or hide the tab labels,
            the preferred citation style (APA 7, MLA 9, Chicago, IEEE) used by Copy as → Formatted and by
            the research chat, and a few more toggles (the pet, the BibTeX abstract and DOI options).{" "}
            <Chip>Developer</Chip> is the control panel for every customization: the cheat console and its
            hotkey, the list of hidden looks with their on/off switches, effects, and the garden's
            scenery switches.
          </P>
          <WikiGallery cols={1} ids={["settings-developer"]} />
        </WikiSub>

        <WikiSub id="cheats" title="The cheat console and the hidden looks">
          <WikiThumb id="cheat-console" width={420} />
          <P>
            Press the backquote key (<Chip>`</Chip>) anywhere, except while typing in a field, and the cheat
            console opens at the top of the page. Type a word and press Enter; words toggle. Besides the
            garden's charm words it understands <Chip>help</Chip>, <Chip>list</Chip> (what you can use),{" "}
            <Chip>off</Chip> (all looks off) and <Chip>dev</Chip> (open the developer panel). Nine hidden words
            change the look of the whole app; none is listed until it has been found by typing it.
          </P>
          <WikiTable
            headers={["Word", "Look", "Effect"]}
            rows={[
              [<Chip key="1">dmg</Chip>, "Pocket Green", "A handheld's four-shade green screen."],
              [<Chip key="2">lumber</Chip>, "Lumberyard", "Warm oak boards and carved edges."],
              [<Chip key="3">matrix</Chip>, "Phosphor", "Green phosphor on black."],
              [<Chip key="4">drafting</Chip>, "Blueprint", "White ink on blueprint blue, with a grid."],
              [<Chip key="5">neon</Chip>, "Neon Horizon", "Magenta and violet with a glowing horizon."],
              [<Chip key="6">scroll</Chip>, "Old Parchment", "Sepia pages and serif type."],
              [<Chip key="7">scanline</Chip>, "Scanlines", "Faint CRT scanlines and a vignette."],
              [<Chip key="8">pixel</Chip>, "Pixel type", "All text in the pixel font."],
              [<Chip key="9">diorama</Chip>, "Live scenery", "The garden's scene drifts behind the pages, dimmed so text stays legible."],
            ]}
          />
          <WikiGallery
            title="The looks"
            cols={3}
            ids={[
              "skin-pocket-green", "skin-lumberyard", "skin-phosphor",
              "skin-blueprint", "skin-neon-horizon", "skin-parchment",
              "skin-scanlines", "skin-pixel-type", "skin-diorama",
            ]}
          />
          <WikiNote kind="note">
            The looks and the garden's cheat words are saved per browser. Presentation mode sets them aside
            and restores them when you leave (<Xref to="/walkthrough/site-modes#presentation">Presentation mode</Xref>).
          </WikiNote>
        </WikiSub>

        <WikiSub id="nerd" title="The NERD switch">
          <P>
            The switch beside the theme button decides whether the Stats for Nerds controls exist at
            all. Off removes them from the Repository, the Arena, the Search page and the Lab, with a pixel
            shatter; on brings them back with a glitch. The choice is remembered. It is covered with the
            screenshots under <Xref to="/walkthrough/repository#repo-stats">Stats for Nerds</Xref>.
          </P>
        </WikiSub>
      </WikiSection>
  );
}

