import random
import copy

class Shuffler:
    def __init__(self, data_manager):
        self.dm = data_manager

    def generate_schedule(self):
        """
        Generates a valid schedule based on constraints.
        Returns a list of 'Team' objects (dictionaries).
        """
        data = self.dm.data
        pairs = data.get("pairs", [])
        classes = data.get("classes", [])
        settings = data.get("settings", {})

        if not pairs or not classes:
            return None

        # 1. Prepare Data
        # Map class name to team count
        team_count_map = {c["name"]: int(c["team_count"]) for c in classes}
        
        opening_pairs = [p for p in pairs if p.get("is_opening")]
        ending_pairs = [p for p in pairs if p.get("is_ending")]
        middle_pairs = [p for p in pairs if not p.get("is_opening") and not p.get("is_ending")]

        # 2. Backbone: Distribute middle pairs into teams per class
        # This is a simplified version of 'generateScheduleWithBackbone'
        # We need to group pairs into 'Teams'. A 'Team' is one performance slot.
        # Each class has 'team_count' slots. We distribute pairs evenly.
        
        all_teams = []
        
        # Add Opening Teams (Virtual teams for now, assuming 1 pair per team or grouped)
        # For simplicity, treating each opening pair as a separate team for now, or group by class?
        # Reference logic didn't explicitly group opening/ending into constrained slots same way as middle.
        # Let's assume opening/ending are handled separately or just added.
        # Reference code: "teams = teams.filter(t => !ending.includes(t)).concat(ending);"
        # It implies opening/ending are also 'teams'.
        
        # Let's process middle pairs first.
        class_teams = {} 
        
        for cls_name, count in team_count_map.items():
            cls_pairs = [p for p in middle_pairs if p["class"] == cls_name]
            if not cls_pairs:
                continue
                
            # Create N empty teams
            teams = [{"class": cls_name, "pairs": []} for _ in range(count)]
            
            # Distribute pairs (Simple Round Robin for now)
            # TODO: Implement 'Heavy Dancer' logic if needed later
            for i, p in enumerate(cls_pairs):
                teams[i % count]["pairs"].append(p)
            
            class_teams[cls_name] = teams
            all_teams.extend(teams)

        # 3. Initial Shuffle
        random.shuffle(all_teams)

        # 4. Fix Consecutive Classes (Ensure no same class back-to-back if possible)
        all_teams = self.fix_consecutive_classes(all_teams)

        # 5. Fix Rest Turns (Ensure dancers have rest)
        all_teams = self.fix_rest_turns(all_teams, settings)
        
        # 6. Add Opening/Ending
        # Assuming Opening is at the start and Ending at the end
        # We wrap opening/ending pairs into teams as well
        final_teams = []
        
        if opening_pairs:
            # Group opening pairs by class? Or just one big opening team?
            # Let's make one team per opening pair for now to be safe, or group by class.
            # Simple approach: One team per pair
            for p in opening_pairs:
                final_teams.append({"class": p["class"], "pairs": [p], "is_opening": True})
        
        final_teams.extend(all_teams)
        
        if ending_pairs:
            for p in ending_pairs:
                final_teams.append({"class": p["class"], "pairs": [p], "is_ending": True})

        return final_teams

    def fix_consecutive_classes(self, teams):
        """
        Reorders teams to minimize consecutive classes.
        Logic: Pick a team from a class that is different from previous and has most remaining teams.
        """
        if not teams: return []
        
        groups = {}
        for t in teams:
            groups.setdefault(t["class"], []).append(t)
            
        result = []
        prev_class = None
        
        total_count = len(teams)
        for _ in range(total_count):
            pick_class = None
            max_remain = -1
            
            # Find best candidate class
            candidates = [c for c in groups.keys() if groups[c]]
            
            # Try to find one different from prev
            valid_candidates = [c for c in candidates if c != prev_class]
            
            if not valid_candidates:
                # Must pick same class (or only one class exists)
                valid_candidates = candidates
            
            if not valid_candidates:
                break # Should not happen if loop logic is correct
                
            # Pick one with most remaining
            for c in valid_candidates:
                if len(groups[c]) > max_remain:
                    max_remain = len(groups[c])
                    pick_class = c
            
            # Add to result
            t = groups[pick_class].pop(0)
            result.append(t)
            prev_class = pick_class
            
        return result

    def fix_rest_turns(self, teams, settings):
        """
        Attempts to swap teams to satisfy min rest constraints.
        """
        min_rest_leader = int(settings.get("min_rest_leader", 2))
        min_rest_follower = int(settings.get("min_rest_follower", 2))
        
        # We'll try a limited number of passes or swaps to avoid infinite loops
        max_passes = 5
        
        for _ in range(max_passes):
            violation_found = False
            last_seen = {} # Dancer -> Index of last appearance
            
            for i in range(len(teams)):
                team = teams[i]
                dancers = self.get_dancers_in_team(team)
                
                current_violation = False
                for d in dancers:
                    last_idx = last_seen.get(d)
                    if last_idx is not None:
                        gap = i - last_idx - 1
                        # Determine role for rest check (simplified: check both or strict?)
                        # Assuming worst case (max requirement) or checking role per pair
                        # Let's use max for safety or specific role check if we tracked it precisely
                        req = min_rest_leader # Defaulting to leader rest for safety
                        if gap < req:
                            current_violation = True
                            break
                    last_seen[d] = i
                
                if current_violation:
                    violation_found = True
                    # Try to swap with a later team
                    if not self.try_swap_forward(teams, i, last_seen, min_rest_leader):
                        pass # Could not fix this specific violation
            
            if not violation_found:
                break
                
        return teams

    def try_swap_forward(self, teams, current_idx, last_seen_map, min_gap):
        """
        Looks for a team ahead (j > current_idx) to swap with, 
        such that swapping doesn't create immediate violations at current_idx.
        """
        for j in range(current_idx + 1, len(teams)):
            # Check if candidate team at j can be moved to current_idx without violation
            cand_team = teams[j]
            cand_dancers = self.get_dancers_in_team(cand_team)
            
            ok_to_move_here = True
            for d in cand_dancers:
                last = last_seen_map.get(d)
                if last is not None:
                    gap = current_idx - last - 1
                    if gap < min_gap:
                        ok_to_move_here = False
                        break
            
            if ok_to_move_here:
                # Swap
                teams[current_idx], teams[j] = teams[j], teams[current_idx]
                return True
        return False

    def get_dancers_in_team(self, team):
        dancers = set()
        for p in team["pairs"]:
            if p["leader"]: dancers.add(p["leader"])
            if p["follower"]: dancers.add(p["follower"])
        return list(dancers)
