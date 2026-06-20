-- Hook achievement progress into existing game actions

-- After PvP attack, increment combat achievements
CREATE OR REPLACE FUNCTION hook_achievement_on_battle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increment attack counter for attacker
  PERFORM increment_achievement(NEW.attacker_id, 'first_blood', 1);
  PERFORM increment_achievement(NEW.attacker_id, 'warrior_10', 1);
  PERFORM increment_achievement(NEW.attacker_id, 'warrior_50', 1);
  PERFORM increment_achievement(NEW.attacker_id, 'warrior_200', 1);

  -- NPC kills if defender is NPC (no real user UUID pattern)
  IF NEW.defender_id IS NULL OR NEW.defender_id::text LIKE 'npc-%' THEN
    PERFORM increment_achievement(NEW.attacker_id, 'npc_slayer_10', 1);
    PERFORM increment_achievement(NEW.attacker_id, 'npc_slayer_50', 1);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_battle ON battle_reports;
CREATE TRIGGER trg_achievement_battle
  AFTER INSERT ON battle_reports
  FOR EACH ROW
  EXECUTE FUNCTION hook_achievement_on_battle();

-- After building upgrade finishes, check building achievements
CREATE OR REPLACE FUNCTION hook_achievement_on_building_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count_5 INTEGER;
  v_count_10 INTEGER;
BEGIN
  IF NEW.level = 1 AND OLD.level = 0 THEN
    PERFORM increment_achievement(NEW.user_id, 'first_build', 1);
  END IF;

  IF NEW.level >= 5 THEN
    SELECT COUNT(*) INTO v_count_5 FROM buildings WHERE user_id = NEW.user_id AND level >= 5;
    PERFORM set_achievement_value(NEW.user_id, 'builder_5', v_count_5);
  END IF;

  IF NEW.level >= 10 THEN
    SELECT COUNT(*) INTO v_count_10 FROM buildings WHERE user_id = NEW.user_id AND level >= 10;
    PERFORM set_achievement_value(NEW.user_id, 'builder_10', v_count_10);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_building ON buildings;
CREATE TRIGGER trg_achievement_building
  AFTER UPDATE OF level ON buildings
  FOR EACH ROW
  WHEN (NEW.level > OLD.level)
  EXECUTE FUNCTION hook_achievement_on_building_upgrade();

-- After mission reward claimed, increment mission achievements
CREATE OR REPLACE FUNCTION hook_achievement_on_mission_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player players%ROWTYPE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM increment_achievement(NEW.user_id, 'mission_first', 1);
    PERFORM increment_achievement(NEW.user_id, 'mission_25', 1);
    PERFORM increment_achievement(NEW.user_id, 'mission_100', 1);

    -- Check if completed with high police heat
    SELECT * INTO v_player FROM players WHERE id = NEW.user_id;
    IF v_player.police_heat >= 80 THEN
      PERFORM increment_achievement(NEW.user_id, 'heat_survivor', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_mission ON user_missions;
CREATE TRIGGER trg_achievement_mission
  AFTER UPDATE OF status ON user_missions
  FOR EACH ROW
  EXECUTE FUNCTION hook_achievement_on_mission_complete();

-- After player level/cash/power changes, update progression/economy achievements
CREATE OR REPLACE FUNCTION hook_achievement_on_player_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Level achievements
  IF NEW.level != OLD.level THEN
    PERFORM set_achievement_value(NEW.id, 'level_5', NEW.level);
    PERFORM set_achievement_value(NEW.id, 'level_10', NEW.level);
    PERFORM set_achievement_value(NEW.id, 'level_20', NEW.level);
    PERFORM set_achievement_value(NEW.id, 'level_50', NEW.level);
  END IF;

  -- Power achievements
  IF NEW.power != OLD.power THEN
    PERFORM set_achievement_value(NEW.id, 'power_1000', NEW.power);
    PERFORM set_achievement_value(NEW.id, 'power_10000', NEW.power);
  END IF;

  -- Economy achievements
  IF NEW.cash > OLD.cash THEN
    PERFORM set_achievement_value(NEW.id, 'rich_100k', NEW.cash);
    PERFORM set_achievement_value(NEW.id, 'rich_1m', NEW.cash);
  END IF;

  IF NEW.diamonds > OLD.diamonds THEN
    PERFORM set_achievement_value(NEW.id, 'diamond_hoarder', NEW.diamonds);
  END IF;

  -- Family join
  IF NEW.family_id IS NOT NULL AND OLD.family_id IS NULL THEN
    PERFORM increment_achievement(NEW.id, 'family_join', 1);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_player ON players;
CREATE TRIGGER trg_achievement_player
  AFTER UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION hook_achievement_on_player_update();
